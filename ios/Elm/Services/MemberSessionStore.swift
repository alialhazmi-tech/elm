import Foundation
import Observation

struct MemberUser: Codable, Sendable {
    var id: String
    var name: String
    var email: String
    var image: String?
}

private struct MemberSessionEnvelope: Codable {
    var user: MemberUser
}

private struct MemberAuthEnvelope: Codable {
    var token: String?
    var user: MemberUser
}

private struct MemberAuthError: Codable {
    var message: String?
    var code: String?
}

enum MemberAuthMode: String, CaseIterable, Identifiable {
    case signUp, signIn
    var id: String { rawValue }
    var label: String { self == .signUp ? "حساب جديد" : "لدي حساب" }
}

@MainActor
@Observable
final class MemberSessionStore {
    var user: MemberUser?
    var loading = false
    var errorMessage: String?
    var authPresented = false

    private let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        return URLSession(configuration: configuration)
    }()

    var isSignedIn: Bool { user != nil }
    var firstName: String { user?.name.split(separator: " ").first.map(String.init) ?? "قارئ العلم" }

    func restore() async {
        do {
            let (data, response) = try await request(URLConstants.authURL("get-session"), method: "GET")
            guard response.statusCode == 200, data != Data("null".utf8) else {
                user = nil
                return
            }
            user = try JSONDecoder().decode(MemberSessionEnvelope.self, from: data).user
        } catch {
            // فشل الاستعادة لا يحجب المحتوى العام ولا يمحو كوكي صالحة.
        }
    }

    func authenticate(mode: MemberAuthMode, name: String, email: String, password: String) async -> Bool {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanEmail.contains("@"), password.count >= 8 else {
            errorMessage = "أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل."
            return false
        }
        if mode == .signUp, cleanName.isEmpty {
            errorMessage = "اكتب الاسم الذي تحب أن نناديك به."
            return false
        }

        loading = true
        errorMessage = nil
        defer { loading = false }
        do {
            let body: [String: String] = mode == .signUp
                ? ["name": cleanName, "email": cleanEmail, "password": password]
                : ["email": cleanEmail, "password": password]
            let encoded = try JSONSerialization.data(withJSONObject: body)
            let endpoint = mode == .signUp ? "sign-up/email" : "sign-in/email"
            let (data, response) = try await request(URLConstants.authURL(endpoint), method: "POST", body: encoded)
            guard (200..<300).contains(response.statusCode) else {
                let remote = try? JSONDecoder().decode(MemberAuthError.self, from: data)
                if response.statusCode == 401 {
                    errorMessage = "البريد أو كلمة المرور غير صحيحة."
                } else if remote?.code == "USER_ALREADY_EXISTS" || remote?.message?.localizedCaseInsensitiveContains("exist") == true {
                    errorMessage = "هذا البريد مسجل. اختر «لدي حساب» للدخول."
                } else {
                    errorMessage = "تعذر إكمال العملية الآن. تحقق من البيانات وحاول مجددًا."
                }
                return false
            }
            user = try JSONDecoder().decode(MemberAuthEnvelope.self, from: data).user
            authPresented = false
            return true
        } catch {
            errorMessage = "تعذر الاتصال بخدمة العضوية. حاول بعد قليل."
            return false
        }
    }

    func signOut() async {
        loading = true
        defer { loading = false }
        _ = try? await request(URLConstants.authURL("sign-out"), method: "POST", body: Data("{}".utf8))
        user = nil
    }

    private func request(_ url: URL, method: String, body: Data? = nil) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw APIClientError.empty }
        return (data, response)
    }
}
