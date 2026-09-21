import Foundation
import Observation

/// الأقسام والسلاسل من الخادم (`/api/mobile/v1/taxonomy`) مع كاش `taxonomy.v1`،
/// وسقوط إلى القائمة المضمّنة حتى يبقى «استكشف» يعمل بلا اتصال أو مع خادم أقدم.
@MainActor
@Observable
final class TaxonomyStore {
    private static let cacheKey = "taxonomy.v1"

    var sections: [TaxonomySection] = TaxonomyStore.fallbackSections
    var series: [SeriesChip] = SeriesPalette.chips
    var archivedSeries: [SeriesChip] = []
    var fromServer = false
    var loading = false
    var errorMessage: String?

    static let fallbackSections: [TaxonomySection] = [
        .init(slug: "politics", name: "سياسة وسياق", shortName: "سياسة", color: "#2f7d66"),
        .init(slug: "economy", name: "اقتصاد واستثمار", shortName: "اقتصاد", color: "#d99a18"),
        .init(slug: "technology", name: "تقنية وذكاء اصطناعي", shortName: "تقنية", color: "#3d6fad"),
        .init(slug: "sciences", name: "علوم ومعرفة", shortName: "علوم", color: "#2e8aa6"),
        .init(slug: "health", name: "صحة وجودة حياة", shortName: "صحة", color: "#12a88f"),
        .init(slug: "sport", name: "رياضة وصناعة", shortName: "رياضة", color: "#c45468"),
        .init(slug: "culture", name: "ثقافة وفكر", shortName: "ثقافة", color: "#e56b2f"),
        .init(slug: "world", name: "عالم وجيوسياسة", shortName: "عالم", color: "#526da8"),
        .init(slug: "varieties", name: "منوعات وظواهر", shortName: "منوعات", color: "#9b5e8f"),
    ]

    /// أيقونة لكل قسم معروف؛ المجهول يأخذ شبكة عامة.
    static func symbol(for slug: String) -> String {
        switch slug {
        case "politics": "globe.europe.africa"
        case "economy": "chart.line.uptrend.xyaxis"
        case "technology": "cpu"
        case "sciences": "atom"
        case "health": "heart"
        case "sport": "sportscourt"
        case "culture": "books.vertical"
        case "world": "globe"
        case "varieties": "sparkles"
        case "business": "briefcase"
        case "art": "paintpalette"
        case "ksa": "building.columns"
        case "current-events": "bolt"
        case "news": "newspaper"
        case "infographics": "chart.bar.xaxis"
        case "videos": "play.rectangle"
        default: "square.grid.2x2"
        }
    }

    /// الأقسام الموضوعية فقط — الأشكال (إنفوجرافيك/فيديو) لها صف مستقل في «شاهد واستمع».
    var topicSections: [TaxonomySection] {
        sections.filter { !["infographics", "videos", "podcasts"].contains($0.slug) }
    }

    func load() async {
        if !fromServer, let cached = AppCache.load(Self.cacheKey),
           let payload = try? JSONDecoder().decode(TaxonomyPayload.self, from: cached.data) {
            apply(payload)
        }
        loading = sections.isEmpty
        errorMessage = nil
        do {
            let (payload, data) = try await APIClient.fetchTaxonomy()
            apply(payload)
            AppCache.save(data, key: Self.cacheKey)
        } catch {
            if !fromServer { errorMessage = "تُعرض قائمة الأقسام المحفوظة." }
        }
        loading = false
    }

    private func apply(_ payload: TaxonomyPayload) {
        if !payload.sections.isEmpty { sections = payload.sections }
        if !payload.series.isEmpty { series = payload.series }
        archivedSeries = payload.archivedSeries
        fromServer = true
    }
}
