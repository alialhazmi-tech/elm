import Foundation

enum URLConstants {
    static let productionAPI = URL(string: "https://elm-production-ea24.up.railway.app")!
    // Railway is the serving origin until alelm.net is cut over from the legacy site.
    // Sharing an article on the legacy origin produces links that do not exist there.
    static let publicSite = productionAPI

    #if DEBUG
    static let localAPI = URL(string: "http://127.0.0.1:3000")
    #endif

    static var mediaOrigin: URL { productionAPI }

    static func mobileHome(on origin: URL) -> URL {
        origin.appending(path: "api/mobile/v1/home")
    }

    static func webHome(on origin: URL) -> URL {
        origin.appending(path: "api/content/home")
    }

    static func publicURL(path: String) -> URL {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return publicSite.appending(path: trimmed)
    }

    static let joinURL = publicURL(path: "/join")
    static let accountURL = publicURL(path: "/account")

    static func authURL(_ path: String) -> URL {
        productionAPI.appending(path: "api/auth").appending(path: path)
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
