import Foundation
import Observation
import SwiftUI

/// وجهة رابط عميق: روابط الويب `https://alelm.net/...` (Universal Links) والمخطط الخاص `alelm://`.
/// المواد والكلمات عبر `ElmLinks`، وتُضاف هنا الصفحات ذات الشاشات الأصلية.
enum DeepLinkRoute: Hashable, Identifiable {
    case story(StoryCard)
    case keyword(String)
    case series(String)
    case section(String)
    case search(String)
    case podcasts
    case jak
    case external(URL)

    var id: String {
        switch self {
        case .story(let card): "story:\(card.apiId)"
        case .keyword(let keyword): "keyword:\(keyword)"
        case .series(let slug): "series:\(slug)"
        case .section(let slug): "section:\(slug)"
        case .search(let query): "search:\(query)"
        case .podcasts: "podcasts"
        case .jak: "jak"
        case .external(let url): "external:\(url.absoluteString)"
        }
    }

    /// يفسّر الرابط؛ `nil` لما لا وجهة له (الرئيسية نفسها مثلًا).
    static func parse(_ raw: URL) -> DeepLinkRoute? {
        let url = ElmLinks.normalized(raw)
        switch ElmLinks.route(url) {
        case .story(let card): return .story(card)
        case .keyword(let keyword): return .keyword(keyword)
        case .external(let external):
            guard ElmLinks.isElmHost(external.host) else { return .external(external) }
            let parts = external.path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
            let query = URLComponents(url: external, resolvingAgainstBaseURL: false)?.queryItems
            switch parts.first {
            case nil: return nil
            case "series" where parts.count == 2: return .series(parts[1])
            case "search":
                let q = query?.first { $0.name == "q" }?.value ?? ""
                return .search(q.removingPercentEncoding ?? q)
            case "podcasts" where parts.count == 1: return .podcasts
            case "jak" where parts.count == 1: return .jak
            case let slug? where parts.count == 1 && !ElmLinks.isReserved(slug): return .section(slug)
            default: return .external(external)
            }
        }
    }
}

/// مخزن الرابط العميق المعلّق — مفرد لأن `onOpenURL` يُثبَّت داخل شاشة الرئيسية
/// (تعديل `ElmApp`/`RootTabView` خارج نطاق هذا التسليم)، والوجهة تُدفع في مكدس تبويب الرئيسية.
@MainActor
@Observable
final class DeepLinkRouter {
    static let shared = DeepLinkRouter()
    var pending: DeepLinkRoute?

    /// يعيد `true` إن وُجدت وجهة للرابط.
    @discardableResult
    func open(_ url: URL) -> Bool {
        guard let route = DeepLinkRoute.parse(url) else { return false }
        pending = route
        return true
    }
}

private struct ElmDeepLinksModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.onOpenURL { url in DeepLinkRouter.shared.open(url) }
    }
}

extension View {
    /// يثبّت `onOpenURL` ويحوّل الرابط إلى وجهة معلّقة يقرؤها جذر تبويب الرئيسية.
    func elmDeepLinks() -> some View { modifier(ElmDeepLinksModifier()) }
}

/// الوجهة الأصلية لكل رابط عميق.
struct DeepLinkDestination: View {
    let route: DeepLinkRoute
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        switch route {
        case .story(let card): StoryDestination(seed: card)
        case .keyword(let keyword): KeywordScreen(keyword: keyword)
        case .series(let slug): SeriesDeepLinkScreen(slug: slug)
        case .section(let slug): BrowseFeedScreen(slug: slug, title: ElmFormat.sectionName(slug))
        case .search(let query): SearchScreen(initialQuery: query)
        case .podcasts: PodcastsScreen()
        case .jak: JakListScreen()
        case .external(let url):
            SafariSheet(url: url).ignoresSafeArea().toolbar(.hidden, for: .navigationBar)
        }
    }
}

/// تغذية سلسلة من رابط عميق: الاسم واللون وحالة الأرشفة من التصنيف (كاش ثم خادم).
private struct SeriesDeepLinkScreen: View {
    let slug: String
    @State private var taxonomy = TaxonomyStore()

    private var resolved: (chip: SeriesChip, archived: Bool) {
        if let chip = taxonomy.series.first(where: { $0.slug == slug }) { return (chip, false) }
        if let chip = taxonomy.archivedSeries.first(where: { $0.slug == slug }) { return (chip, true) }
        let swatch = SeriesPalette.active.first { $0.id == slug }
        return (SeriesChip(slug: slug, name: swatch?.name ?? slug, description: "", color: swatch?.colorHex ?? "2B5C9E"), false)
    }

    var body: some View {
        let entry = resolved
        SeriesFeedScreen(chip: entry.chip, archived: entry.archived)
            .id("\(slug):\(entry.archived)")
            .task { await taxonomy.load() }
    }
}
