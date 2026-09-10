import SwiftUI

/// Topic and format navigation is a destination, separate from the daily reading feed.
/// الأقسام والسلاسل من `/api/mobile/v1/taxonomy` (كاش `taxonomy.v1`) مع سقوط للقائمة المضمّنة.
struct DiscoverScreen: View {
    var showBack = false
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var taxonomy = TaxonomyStore()
    #if DEBUG
    @State private var debugRoute: DiscoverDebugRoute?
    #endif

    private var sectionColumns: Int {
        if typeSize.isAccessibilitySize { return 1 }
        return sizeClass == .regular ? 4 : 2
    }

    var body: some View {
        ElmScreen(title: "استكشف", showBack: showBack, onRefresh: { await taxonomy.load() }) {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("اتبع فضولك").font(ElmFonts.display(.largeTitle, weight: .bold))
                    Text("موضوع يهمّك، أو زاوية لم تفكّر بها.")
                        .font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2)
                }
                NavigationLink { SeriesScreen(showBack: true) } label: {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("سلاسل العلم").font(ElmFonts.display(.title2, weight: .bold))
                            Spacer()
                            Image(systemName: "arrow.left")
                        }
                        Text(taxonomy.series.prefix(3).map(\.name).joined(separator: "، ") + "…\nزوايا مختلفة لفهم القصة.")
                            .font(ElmFonts.text(.body)).lineSpacing(5)
                        HStack(spacing: 5) {
                            ForEach(taxonomy.series) { item in
                                Capsule().fill(ElmTheme.hex(item.color)).frame(height: 6)
                            }
                        }.accessibilityHidden(true)
                    }.foregroundStyle(ElmTheme.ink).padding(22)
                        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 24))
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 14) {
                    SectionHead(title: "حسب الموضوع")
                    if let error = taxonomy.errorMessage {
                        Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: sectionColumns), spacing: 0) {
                        ForEach(taxonomy.topicSections) { item in
                            NavigationLink { BrowseFeedScreen(slug: item.slug, title: item.shortName, subtitle: item.name == item.shortName ? "" : item.name) } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: TaxonomyStore.symbol(for: item.slug)).font(.system(.title3))
                                        .foregroundStyle(item.color.map { ElmTheme.hex($0) } ?? ElmTheme.navyInk).frame(width: 25)
                                    Text(item.shortName).font(ElmFonts.text(.body, weight: .medium))
                                }.frame(maxWidth: .infinity, minHeight: 66, alignment: .leading)
                                    .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
                            }.buttonStyle(.plain).accessibilityLabel(item.name)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 10) {
                    SectionHead(title: "شاهد واستمع")
                    let formats = AnyLayout(sizeClass == .regular && !typeSize.isAccessibilitySize
                        ? AnyLayout(GridLayout(columns: 2)) : AnyLayout(VStackLayout(alignment: .leading, spacing: 10)))
                    formats {
                        NavigationLink { BrowseFeedScreen(slug: "infographics", title: "إنفوجرافيك") } label: {
                            formatRow("إنفوجرافيك", detail: "البيانات في صورة", symbol: "chart.bar.xaxis")
                        }
                        NavigationLink { BrowseFeedScreen(slug: "videos", title: "فيديو") } label: {
                            formatRow("فيديو", detail: "قصص تُشاهد", symbol: "play.rectangle")
                        }
                        NavigationLink { PodcastsScreen() } label: {
                            formatRow("بودكاست", detail: "برامج العلم وحلقاتها — تشغيل داخل التطبيق", symbol: "headphones")
                        }
                        NavigationLink { JakListScreen() } label: {
                            formatRow("جاك العلم", detail: "تقارير مصوّرة بصفحات تُقلَّب", symbol: "rectangle.stack")
                        }
                    }
                }.buttonStyle(.plain)
            }.foregroundStyle(ElmTheme.ink).padding(20)
                .frame(maxWidth: sizeClass == .regular ? 1000 : .infinity)
                .frame(maxWidth: .infinity)
        }
        .task { await taxonomy.load() }
        #if DEBUG
        .task { debugRoute = ElmLaunch.discover.flatMap(DiscoverDebugRoute.init(raw:)) }
        .navigationDestination(item: $debugRoute) { route in
            switch route {
            case .podcasts: PodcastsScreen()
            case .jak: JakListScreen()
            case .keyword(let keyword): KeywordScreen(keyword: keyword)
            }
        }
        #endif
    }
    private func formatRow(_ title: String, detail: String, symbol: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).font(.system(.title2)).foregroundStyle(ElmTheme.navyInk).frame(width: 34)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(ElmFonts.text(.headline, weight: .semibold))
                Text(detail).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.left").font(.system(.caption)).foregroundStyle(ElmTheme.ink3)
        }.padding(16).frame(maxWidth: .infinity).background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16))
    }
}

/// شبكة بعمودين ثابتين لصفوف الأشكال على iPad — `Layout` مخصص يضع من اليمين يدويًا (لا يرث الاتجاه).
struct GridLayout: Layout {
    var columns = 2
    var spacing: CGFloat = 12

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        let cell = (width - spacing * CGFloat(columns - 1)) / CGFloat(columns)
        var height: CGFloat = 0
        for row in stride(from: 0, to: subviews.count, by: columns) {
            let rowHeight = subviews[row..<min(row + columns, subviews.count)]
                .map { $0.sizeThatFits(ProposedViewSize(width: cell, height: nil)).height }.max() ?? 0
            height += rowHeight + (row == 0 ? 0 : spacing)
        }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let cell = (bounds.width - spacing * CGFloat(columns - 1)) / CGFloat(columns)
        var y = bounds.minY
        for row in stride(from: 0, to: subviews.count, by: columns) {
            let slice = subviews[row..<min(row + columns, subviews.count)]
            let rowHeight = slice.map { $0.sizeThatFits(ProposedViewSize(width: cell, height: nil)).height }.max() ?? 0
            for (column, view) in slice.enumerated() {
                let x = bounds.maxX - cell - CGFloat(column) * (cell + spacing)
                view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: cell, height: rowHeight))
            }
            y += rowHeight + spacing
        }
    }
}

#if DEBUG
enum DiscoverDebugRoute: Hashable, Identifiable {
    case podcasts, jak, keyword(String)
    var id: String {
        switch self {
        case .podcasts: "podcasts"
        case .jak: "jak"
        case .keyword(let k): "keyword:\(k)"
        }
    }
    init?(raw: String) {
        if raw == "podcasts" { self = .podcasts }
        else if raw == "jak" { self = .jak }
        else if raw.hasPrefix("keyword:") { self = .keyword(String(raw.dropFirst(8))) }
        else { return nil }
    }
}
#endif

struct BrowseFeedScreen: View {
    var kind = "section"
    let slug: String
    let title: String
    var subtitle = ""
    /// كيكر فوق العنوان — «من أرشيف العلم» للسلاسل المتقاعدة كما على الويب.
    var kicker: String? = nil
    @State private var stories: [StoryCard] = []
    @State private var total: Int?
    @State private var nextPage: Int? = 1
    @State private var loading = false
    @State private var error: String?
    @State private var notFound = false
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    private var columns: [GridItem] {
        let count = sizeClass == .regular && !typeSize.isAccessibilitySize ? 2 : 1
        return Array(repeating: GridItem(.flexible(), spacing: 24, alignment: .top), count: count)
    }

    var body: some View {
        ElmScreen(title: title, showBack: true, onRefresh: { await load(reset: true) }) {
            LazyVStack(alignment: .leading, spacing: 18) {
                if let kicker, !kicker.isEmpty {
                    KickerBar(label: kicker, color: ElmTheme.gold)
                }
                Text(title).font(ElmFonts.display(.largeTitle, weight: .bold)).foregroundStyle(ElmTheme.ink)
                if !subtitle.isEmpty { Text(subtitle).font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2) }
                if let total, !notFound { Text("\(ElmFormat.materialLabel(total)) منشورة").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
                LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                    ForEach(stories) { story in NativeStoryRow(story: story) }
                }
                if notFound {
                    // قسم/سلسلة مجهولان = 404 على الويب لا خطأ اتصال.
                    ContentUnavailableView(kind == "series" ? "السلسلة غير موجودة" : "القسم غير موجود", systemImage: "questionmark.folder",
                                           description: Text("تحقق من الرابط أو تصفّح الأقسام من «استكشف»."))
                } else if let error {
                    Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                    Button("إعادة المحاولة") { Task { await load(reset: stories.isEmpty) } }.frame(minHeight: 44)
                } else if stories.isEmpty && !loading && total != nil {
                    ContentUnavailableView("لا مواد منشورة بعد", systemImage: "doc.text.magnifyingglass")
                }
                if loading { ProgressView().frame(maxWidth: .infinity).padding(20) }
                else if nextPage != nil && error == nil && !stories.isEmpty {
                    Button("عرض المزيد") { Task { await load(reset: false) } }
                        .font(ElmFonts.text(.body, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 48)
                        .background(ElmTheme.surface2, in: Capsule())
                }
            }.padding(20)
                .frame(maxWidth: sizeClass == .regular ? 1000 : .infinity)
                .frame(maxWidth: .infinity)
        }.task { if stories.isEmpty { await load(reset: true) } }
    }

    @MainActor private func load(reset: Bool) async {
        guard !loading, let page = reset ? 1 : nextPage else { return }
        loading = true
        error = nil
        notFound = false
        defer { loading = false }
        do {
            let result = try await APIClient.fetchBrowse(kind: kind, slug: slug, page: page)
            try Task.checkCancellation()
            var seen = Set<String>()
            stories = ((reset ? [] : stories) + result.stories).filter { seen.insert($0.apiId).inserted }
            total = result.total
            nextPage = result.nextPage
            ImageStore.shared.prefetch(result.stories.compactMap(\.imageURL))
        } catch is CancellationError { }
        catch APIClientError.badStatus(404) { notFound = true; nextPage = nil }
        catch ElmAPIError.notFound { notFound = true; nextPage = nil }
        catch { self.error = "تعذر تحميل الأرشيف. تحقق من الاتصال وأعد المحاولة." }
    }
}
