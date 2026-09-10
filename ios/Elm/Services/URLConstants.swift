import Foundation

enum URLConstants {
    static let productionAPI = URL(string: "https://elm-production-ea24.up.railway.app")!
    // Canonical public links; API origin retains existing authenticated sessions.
    static let publicSite = URL(string: "https://alelm.net")!

    #if DEBUG
    // Explicit development origin: never silently mix local and production content.
    static var localAPI: URL? {
        guard let raw = ProcessInfo.processInfo.environment["ELM_API_ORIGIN"],
              let url = URL(string: raw), ["localhost", "127.0.0.1"].contains(url.host ?? "") else { return nil }
        return url
    }
    #endif

    static var contentAPI: URL {
        #if DEBUG
        if let localAPI { return localAPI }
        #endif
        return productionAPI
    }
    static var mediaOrigin: URL { contentAPI }

    /// أصل لوحة «تحرير العلم» — يتبع أصل المحتوى (محلي في التطوير، الإنتاج في الإصدار).
    static var staffAPI: URL { contentAPI }

    /// أصل العضوية والتفاعل (كوكي Neon Auth تشترط HTTPS)؛ في التطوير يمكن توجيهه صراحةً.
    static var memberAPI: URL {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["ELM_AUTH_ORIGIN"], let url = URL(string: raw) { return url }
        #endif
        return productionAPI
    }

    static func mobileHome(on origin: URL) -> URL {
        origin.appending(path: "api/mobile/v1/home")
    }

    static func webHome(on origin: URL) -> URL {
        origin.appending(path: "api/content/home")
    }

    static func publicURL(path: String) -> URL {
        let relative = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: relative, relativeTo: publicSite)?.absoluteURL ?? publicSite
    }

    static let joinURL = publicURL(path: "/join")
    static let accountURL = publicURL(path: "/account")

    static func authURL(_ path: String) -> URL {
        memberAPI.appending(path: "api/auth").appending(path: path)
    }
}

enum ElmMedia {
    static func url(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        if raw.hasPrefix("http://") || raw.hasPrefix("https://") {
            return parse(raw)
        }
        let path = raw.hasPrefix("/") ? raw : "/\(raw)"
        return parse(URLConstants.mediaOrigin.absoluteString + path)
    }

    private static func parse(_ raw: String) -> URL? {
        if let url = URL(string: raw) { return encoded(url) }
        var allowed = CharacterSet.urlFragmentAllowed
        allowed.insert(charactersIn: "%")
        return raw.addingPercentEncoding(withAllowedCharacters: allowed)
            .flatMap(URL.init(string:))
            .map(encoded)
    }

    /// مسارات ووردبريس العربية تُكسر إن بقيت بلا ترميز في URLSession.
    private static func encoded(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        let allowed = CharacterSet.urlPathAllowed
        components.percentEncodedPath = components.path.addingPercentEncoding(withAllowedCharacters: allowed)
            ?? components.percentEncodedPath
        return components.url ?? url
    }
}
