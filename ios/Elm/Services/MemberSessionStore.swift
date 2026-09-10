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
    var error: String?
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
    /// الوضع الذي تفتح عليه ورقة الدخول (شاشة العضوية تفتح «حساب جديد» أو «لدي حساب» مباشرة).
    var authInitialMode: MemberAuthMode = .signUp
    /// الجلسة قائمة لكن حالة العضوية «معلّق» — لا يُعرض المستخدم كمسجّل أبدًا في هذه الحالة.
    var suspended = false

    /// نص الويب في `/join` للحساب المعلّق.
    static let suspendedTitle = "حسابك معلّق"
    static let suspendedText = "الوصول إلى خدمات العضوية موقوف حاليًا. تواصل مع إدارة العلم لمراجعة حالة حسابك."

    // قواعد التحقق نفسها التي يطبقها `app/join/actions.ts`.
    private static let emailPattern = try! NSRegularExpression(pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    static func validEmail(_ email: String) -> Bool {
        guard email.count <= 256 else { return false }
        let range = NSRange(email.startIndex..., in: email)
        return emailPattern.firstMatch(in: email, range: range) != nil
    }

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
                // `null` يعني زائرًا أو حسابًا معلّقًا بكوكي قائمة؛ نفحص التعليق فقط حين توجد كوكي.
                suspended = hasMemberCookie ? await APIClient.memberSuspended() : false
                return
            }
            user = try JSONDecoder().decode(MemberSessionEnvelope.self, from: data).user
            suspended = false
        } catch {
            // فشل الاستعادة لا يحجب المحتوى العام ولا يمحو كوكي صالحة.
        }
    }

    /// أي مسار `/api/me/*` ردّ 401 رغم أن التطبيق يظن الجلسة قائمة: نعيد الاستعادة لنكتشف
    /// الخروج أو التعليق بدل إبقاء حساب «مسجّل» لا تعمل خدماته.
    func revalidate() async {
        guard isSignedIn else { return }
        await restore()
    }

    func authenticate(mode: MemberAuthMode, name: String, email: String, password: String) async -> Bool {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if mode == .signUp {
            guard !cleanName.isEmpty, cleanName.count <= 40 else {
                errorMessage = "أدخل اسمًا صحيحًا لا يتجاوز 40 حرفًا."
                return false
            }
            guard Self.validEmail(cleanEmail) else {
                errorMessage = "أدخل بريدًا إلكترونيًا صحيحًا."
                return false
            }
            guard (8...128).contains(password.count) else {
                errorMessage = "كلمة المرور يجب أن تكون بين 8 و128 حرفًا."
                return false
            }
        } else {
            guard Self.validEmail(cleanEmail), !password.isEmpty else {
                errorMessage = "أدخل البريد وكلمة المرور."
                return false
            }
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
                let text = remote?.error ?? remote?.message ?? ""
                if response.statusCode == 403, text.contains("معل") {
                    // كوكي حساب معلّق قائمة: الوسيط يرفض كل المسارات عدا الخروج.
                    user = nil
                    suspended = true
                    errorMessage = Self.suspendedText
                } else if response.statusCode == 401 {
                    errorMessage = "البريد أو كلمة المرور غير صحيحة."
                } else if remote?.code == "USER_ALREADY_EXISTS" || remote?.message?.localizedCaseInsensitiveContains("exist") == true {
                    errorMessage = "هذا البريد مسجل. اختر «لدي حساب» للدخول."
                } else {
                    errorMessage = "تعذر إكمال العملية الآن. تحقق من البيانات وحاول مجددًا."
                }
                return false
            }
            let signed = try JSONDecoder().decode(MemberAuthEnvelope.self, from: data).user
            // الدخول ينجح للحساب المعلّق (لا جلسة قبل الفحص)؛ نتحقق قبل إظهاره مسجّلًا.
            if await APIClient.memberSuspended() {
                user = nil
                suspended = true
                errorMessage = Self.suspendedText
                return false
            }
            suspended = false
            user = signed
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
        suspended = false
    }

    private var hasMemberCookie: Bool {
        !(HTTPCookieStorage.shared.cookies(for: URLConstants.memberAPI) ?? []).isEmpty
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
