import Foundation

/// خطأ موحّد لكل طلبات التطبيق: يحمل رسالة عربية صالحة للعرض مباشرة،
/// ويميّز انتهاء الجلسة والصلاحية والتعارض وبوابات الحارس حتى تتصرف الشاشات بدقة.
enum ElmAPIError: Error, LocalizedError, Equatable {
    case offline
    case timeout
    case unauthorized(String)
    case forbidden(String, permission: String?, mfaRequired: Bool)
    case conflict(String)
    case guardBlocked(String, blocking: [String])
    case rateLimited(String, retryAfter: Int?)
    case notFound(String)
    case invalid(String)
    case server(Int, String)
    case decoding

    var errorDescription: String? { message }

    var message: String {
        switch self {
        case .offline: return "لا يوجد اتصال بالإنترنت."
        case .timeout: return "انتهت مهلة الطلب. حاول مجددًا."
        case .unauthorized(let text): return text.isEmpty ? "الجلسة منتهية. سجّل الدخول مجددًا." : text
        case .forbidden(let text, _, _): return text.isEmpty ? "ليست لديك صلاحية هذا الإجراء." : text
        case .conflict(let text): return text.isEmpty ? "تغيّرت البيانات منذ فتحها. أعد التحميل." : text
        case .guardBlocked(let text, _): return text.isEmpty ? "الحارس التحريري يمنع هذا الإجراء." : text
        case .rateLimited(let text, _): return text.isEmpty ? "محاولات كثيرة. حاول بعد قليل." : text
        case .notFound(let text): return text.isEmpty ? "العنصر غير موجود." : text
        case .invalid(let text): return text.isEmpty ? "البيانات غير صالحة." : text
        case .server(let status, let text): return text.isEmpty ? "تعذر إتمام الطلب (\(status))." : text
        case .decoding: return "تعذر قراءة رد الخادم."
        }
    }

    var isUnauthorized: Bool {
        if case .unauthorized = self { return true }
        return false
    }

    var isConnectivity: Bool {
        switch self {
        case .offline, .timeout: return true
        default: return false
        }
    }

    /// رسالة الخادم من `{error, permission?, mfaRequired?, blocking?}` أو نص بديل.
    static func from(status: Int, data: Data) -> ElmAPIError {
        struct Finding: Decodable { var ruleId: String?; var message: String? }
        struct Envelope: Decodable {
            var error: String?
            var message: String?
            var permission: String?
            var mfaRequired: Bool?
            var blocking: [String]?
            var findings: [Finding]?
        }
        let envelope = try? JSONDecoder().decode(Envelope.self, from: data)
        let text = envelope?.error ?? envelope?.message ?? ""
        // بوابة الحارس: رسائل المخالفات أوضح للمحرر من معرّفات القواعد.
        let blockingMessages: [String] = (envelope?.findings ?? []).compactMap { finding in
            guard let rule = finding.ruleId, envelope?.blocking?.contains(rule) ?? true else { return nil }
            return finding.message ?? rule
        }
        switch status {
        case 401: return .unauthorized(text)
        case 403: return .forbidden(text, permission: envelope?.permission, mfaRequired: envelope?.mfaRequired ?? false)
        case 404: return .notFound(text)
        case 409: return .conflict(text)
        case 422: return .guardBlocked(text, blocking: blockingMessages.isEmpty ? (envelope?.blocking ?? []) : blockingMessages)
        case 429: return .rateLimited(text, retryAfter: nil)
        case 400, 413, 415: return .invalid(text)
        default: return .server(status, text)
        }
    }

    static func wrap(_ error: Error) -> ElmAPIError {
        if let api = error as? ElmAPIError { return api }
        if let legacy = error as? APIClientError {
            switch legacy {
            case .unauthorized: return .unauthorized("")
            case .badStatus(let status): return .server(status, "")
            case .empty: return .decoding
            }
        }
        if error is DecodingError { return .decoding }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            switch ns.code {
            case NSURLErrorTimedOut: return .timeout
            case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorCannotConnectToHost, NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed:
                return .offline
            default: break
            }
        }
        return .server(0, "تعذر الاتصال بالخادم. تحقق من الشبكة وأعد المحاولة.")
    }
}

/// جزء من نموذج متعدد الأجزاء (رفع صورة).
struct ElmMultipartFile {
    var field: String
    var filename: String
    var mime: String
    var data: Data
}

/// طبقة النقل المشتركة: جلسة واحدة تشارك كوكي `HTTPCookieStorage.shared` (عضوية القرّاء
/// وجلسة «تحرير العلم» معًا)، ترويسة Origin لمسارات الويب التي تشترطها، وأخطاء عربية موحّدة.
enum ElmHTTP {
    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 120
        config.waitsForConnectivity = false
        config.httpMaximumConnectionsPerHost = 6
        return URLSession(configuration: config)
    }()

    static let decoder = JSONDecoder()

    static func url(_ origin: URL, _ path: String, query: [String: String?] = [:]) -> URL {
        var components = URLComponents(url: origin.appending(path: path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { key, value -> URLQueryItem? in
            guard let value, !value.isEmpty else { return nil }
            return URLQueryItem(name: key, value: value)
        }
        components.queryItems = items.isEmpty ? nil : items
        return components.url!
    }

    /// طلب خام: يعيد البيانات والرد أو يرمي `ElmAPIError` بحسب الحالة.
    @discardableResult
    static func request(
        _ url: URL,
        method: String = "GET",
        json: Any? = nil,
        file: ElmMultipartFile? = nil,
        fields: [String: String] = [:],
        headers: [String: String] = [:],
        timeout: TimeInterval = 25,
        origin: Bool = true
    ) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if origin, let scheme = url.scheme, let host = url.host {
            let port = url.port.map { ":\($0)" } ?? ""
            request.setValue("\(scheme)://\(host)\(port)", forHTTPHeaderField: "Origin")
        }
        for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
        if let json {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: json)
        } else if let file {
            let boundary = "ElmBoundary-\(UUID().uuidString)"
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            var body = Data()
            for (key, value) in fields {
                body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!)
            }
            body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(file.field)\"; filename=\"\(file.filename)\"\r\nContent-Type: \(file.mime)\r\n\r\n".data(using: .utf8)!)
            body.append(file.data)
            body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
            request.httpBody = body
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw ElmAPIError.wrap(error)
        }
        guard let http = response as? HTTPURLResponse else { throw ElmAPIError.decoding }
        guard (200..<300).contains(http.statusCode) || http.statusCode == 304 else {
            throw ElmAPIError.from(status: http.statusCode, data: data)
        }
        return (data, http)
    }

    static func get<T: Decodable>(_ url: URL, headers: [String: String] = [:], timeout: TimeInterval = 25) async throws -> T {
        let (data, _) = try await request(url, headers: headers, timeout: timeout)
        return try decode(T.self, from: data)
    }

    static func send<T: Decodable>(_ url: URL, method: String = "POST", json: Any, timeout: TimeInterval = 25) async throws -> T {
        let (data, _) = try await request(url, method: method, json: json, timeout: timeout)
        return try decode(T.self, from: data)
    }

    static func upload<T: Decodable>(_ url: URL, file: ElmMultipartFile, fields: [String: String] = [:], timeout: TimeInterval = 90) async throws -> T {
        let (data, _) = try await request(url, method: "POST", file: file, fields: fields, timeout: timeout)
        return try decode(T.self, from: data)
    }

    static func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            #if DEBUG
            print("ElmHTTP decode failed for \(T.self): \(error)")
            #endif
            throw ElmAPIError.decoding
        }
    }
}

/// رد بسيط `{ok:true}`.
struct OKResponse: Decodable {
    var ok: Bool?
}
