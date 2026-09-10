import Foundation

/// توجيه الروابط داخل المتن: روابط العلم `/{section}/{id}/{slug}` تُفتح أصلًا،
/// و`/keywords/{كلمة}` تفتح شاشة الكلمة، وما عداها في Safari داخل التطبيق.
enum ElmLinkRoute: Equatable {
    case story(StoryCard)
    case keyword(String)
    case external(URL)
}

enum ElmLinks {
    /// مسارات على أصل العلم ليست موادّ رغم أنها بثلاثة مقاطع.
    private static let reserved: Set<String> = [
        "keywords", "series", "podcasts", "join", "account", "api", "search", "about", "contact",
        "privacy", "welcome", "tahrir", "uploads", "_next", "podcast-audio", "infographics-data",
    ]

    static func isElmHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        if host == "alelm.net" || host == "www.alelm.net" { return true }
        if host == URLConstants.productionAPI.host?.lowercased() { return true }
        if host == URLConstants.contentAPI.host?.lowercased() { return true }
        return false
    }

    static func route(_ url: URL) -> ElmLinkRoute {
        let relative = url.host == nil || isElmHost(url.host)
        guard relative else { return .external(url) }
        let parts = url.path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        if parts.count == 2, parts[0] == "keywords" {
            return .keyword(parts[1].removingPercentEncoding ?? parts[1])
        }
        if parts.count == 3, !reserved.contains(parts[0]) {
            let path = "/" + parts.joined(separator: "/")
            return .story(StoryCard(id: parts[1], slug: parts[2], section: parts[0], title: "", excerpt: "", href: path))
        }
        if url.host == nil, let absolute = URL(string: url.path, relativeTo: URLConstants.publicSite)?.absoluteURL {
            return .external(absolute)
        }
        return .external(url)
    }

    static func route(path: String) -> ElmLinkRoute? {
        URL(string: path.hasPrefix("/") ? path : "/\(path)", relativeTo: URLConstants.publicSite).map { route($0.absoluteURL) }
    }
}
