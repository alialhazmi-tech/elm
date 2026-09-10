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

    /// هل المقطع الأول محجوز (ليس قسمًا)؟
    static func isReserved(_ segment: String) -> Bool { reserved.contains(segment) }

    static func isElmHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        if host == "alelm.net" || host == "www.alelm.net" { return true }
        if host == URLConstants.productionAPI.host?.lowercased() { return true }
        if host == URLConstants.contentAPI.host?.lowercased() { return true }
        return false
    }

    /// المخطط الخاص `alelm://` — المضيف هو أول مقطع من المسار: `alelm://politics/263004/slug`.
    static let scheme = "alelm"

    /// يحوّل رابط المخطط الخاص إلى رابط على أصل العلم؛ روابط الويب تمر كما هي.
    static func normalized(_ url: URL) -> URL {
        guard url.scheme?.lowercased() == scheme else { return url }
        var path = "/" + (url.host ?? "") + url.path
        if let query = url.query, !query.isEmpty { path += "?" + query }
        return URL(string: path, relativeTo: URLConstants.publicSite)?.absoluteURL ?? url
    }

    static func route(_ raw: URL) -> ElmLinkRoute {
        let url = normalized(raw)
        let relative = url.host == nil || isElmHost(url.host)
        guard relative else { return .external(url) }
        let parts = url.path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        if parts.count == 2, parts[0] == "keywords" {
            return .keyword(parts[1].removingPercentEncoding ?? parts[1])
        }
        // رابط المشاركة المُصدَّر `/share/{id}/{ver}` — المعرّف هو المقطع الثاني، والقسم يأتي من الخادم.
        if parts.count == 3, parts[0] == "share" {
            return .story(StoryCard(id: parts[1], slug: parts[1], section: "news", title: "", excerpt: "", href: "/share/\(parts[1])/\(parts[2])"))
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
