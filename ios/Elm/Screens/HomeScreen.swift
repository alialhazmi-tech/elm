import SwiftUI

/// A daily reading desk with separate context and visual selections.
struct HomeScreen: View {
    @State private var store = HomeStore()
    @State private var selection = HomeSelection.today
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.horizontalSizeClass) private var sizeClass
    #if DEBUG
    @State private var debugStory: StoryCard?
    #endif

    /// iPad (عرض منتظم): عمودان للصدارة والموجز، وشبكة بعمودين للصفوف.
    private var wide: Bool { sizeClass == .regular && !typeSize.isAccessibilitySize }
    private var rowColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 28, alignment: .top), count: wide ? 2 : 1)
    }

    private enum HomeSelection: String, CaseIterable { case today = "اليوم", context = "وراء الخبر", visual = "مرئي وبيانات" }

    var body: some View {
        ScrollViewReader { proxy in
            ElmScreen(showBrand: true, onRefresh: { await store.refresh() }) {
                if let home = store.payload { feed(home) }
                else if store.loading {
                    ProgressView("جاري تحميل الرئيسية").frame(maxWidth: .infinity).padding(.top, 100)
                } else {
                    ContentUnavailableView {
                        Label("تعذر تحميل الرئيسية", systemImage: "wifi.slash")
                    } description: { Text(store.errorMessage ?? "تحقق من الاتصال ثم أعد المحاولة.") }
                    actions: { Button("إعادة المحاولة") { Task { await store.refresh() } } }
                }
            }
            .task { await store.load() }
            #if DEBUG
            .task {
                if let id = ElmLaunch.storyId {
                    let embed = ElmLaunch.storyVideo
                    debugStory = StoryCard(id: id, slug: id, section: "news", title: "", excerpt: "", href: "/news/\(id)/\(id)",
                                           videoUrl: embed == nil ? nil : "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoEmbedUrl: embed, videoKind: embed == nil ? nil : "youtube")
                }
            }
            .navigationDestination(item: $debugStory) { card in StoryDestination(seed: card) }
            .task(id: store.payload?.generatedAt) {
                if store.payload != nil, let section = ElmLaunch.homeSection {
                    if ["numbers", "media", "infographics"].contains(section) { selection = .visual }
                    if section == "context" { selection = .context }
                    await Task.yield()
                    proxy.scrollTo(section, anchor: .top)
                }
            }
            #endif
        }
    }

    private func feed(_ home: MobileHomePayload) -> some View {
        LazyVStack(alignment: .leading, spacing: 24) {
            if store.fromCache {
                Text("تُعرض آخر نسخة محفوظة. اسحب للتحديث.")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            }
            DayStrip()
            if let breaking = home.breaking {
                HomeNewsStrip(items: [NewsStripItem(title: breaking.title, href: breaking.href, urgent: true)])
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) { selectionButtons }
            } else {
                HStack(spacing: 8) { selectionButtons }
            }
            switch selection {
            case .today:
                let latest = home.presentation?.stream?.river ?? home.minis
                if wide {
                    // الصدارة يمينًا، والموجز مع أول الجديد يسارًا — عمودان بنسبة 3:2.
                    HStack(alignment: .top, spacing: 28) {
                        NativeHomeLead(story: home.hero).id("lead").frame(maxWidth: .infinity)
                        VStack(alignment: .leading, spacing: 18) {
                            if !home.brief.isEmpty { NativeBriefEntry(home: home).id("brief") }
                            ForEach(latest.prefix(3)) { NativeStoryRow(story: $0) }
                        }.frame(maxWidth: .infinity)
                    }
                    let rest = Array(latest.dropFirst(3))
                    if !rest.isEmpty {
                        SectionHead(title: "الجديد الآن")
                        rows(rest)
                    }
                } else {
                    NativeHomeLead(story: home.hero).id("lead")
                    if !home.brief.isEmpty { NativeBriefEntry(home: home).id("brief") }
                    if !latest.isEmpty {
                        SectionHead(title: "الجديد الآن")
                        rows(latest)
                    }
                }
            case .context:
                SectionHead(title: "وراء الخبر", subtitle: "اقرأ السياق، وافهم ما وراء العنوان.").id("context")
                rows(home.mosaic)
                let archive = home.presentation?.archive ?? home.mostRead
                if !archive.isEmpty {
                    SectionHead(title: "من الأرشيف")
                    rows(archive)
                }
            case .visual:
                let graphics = home.presentation?.stream?.infographics ?? [home.dataStory].compactMap { $0 }
                if !graphics.isEmpty {
                    SectionHead(title: "إنفوجرافيك", subtitle: "البيانات في صورة").id("infographics")
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 20, alignment: .top), count: wide ? 3 : 1), alignment: .leading, spacing: 20) {
                        ForEach(graphics) { StoryTile(story: $0) }
                    }
                    NavigationLink("كل الإنفوجرافيك") { BrowseFeedScreen(slug: "infographics", title: "إنفوجرافيك") }
                        .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 44)
                }
                if !home.numbers.isEmpty { HomeNumbers(stats: home.numbers, wide: wide).id("numbers") }
                if !home.videos.isEmpty {
                    SectionHead(title: "فيديو").id("media")
                    rows(home.videos)
                    NavigationLink("كل الفيديو") { BrowseFeedScreen(slug: "videos", title: "فيديو") }
                        .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 44)
                }
                NavigationLink { PodcastsScreen() } label: {
                    Label("استمع إلى بودكاست العلم", systemImage: "headphones")
                        .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 48)
                }.buttonStyle(.plain).foregroundStyle(ElmTheme.navyInk)
            }
        }.padding(.horizontal, 20).padding(.top, 14)
            .frame(maxWidth: wide ? 1040 : .infinity)
            .frame(maxWidth: .infinity)
    }

    /// صفوف المواد: عمود واحد على iPhone، وعمودان على iPad.
    private func rows(_ stories: [StoryCard]) -> some View {
        LazyVGrid(columns: rowColumns, alignment: .leading, spacing: 20) {
            ForEach(stories) { NativeStoryRow(story: $0) }
        }
    }

    private var selectionButtons: some View {
        ForEach(HomeSelection.allCases, id: \.self) { item in
            Button { selection = item } label: {
                Text(item.rawValue).font(ElmFonts.text(.subheadline, weight: selection == item ? .bold : .medium))
                    .foregroundStyle(selection == item ? ElmTheme.bg : ElmTheme.ink2)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(selection == item ? ElmTheme.ink : ElmTheme.surface2, in: Capsule())
            }.buttonStyle(.plain).accessibilityAddTraits(selection == item ? .isSelected : [])
        }
    }
}

extension SeriesPalette {
    static var chips: [SeriesChip] {
        active.map { SeriesChip(slug: $0.id, name: $0.name, description: "", color: $0.colorHex) }
    }
}

private struct HomeNumbers: View {
    let stats: [NumberStat]
    var wide = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHead(title: "بالأرقام", subtitle: "كل رقم يحيل إلى مصدره")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16, alignment: .top), count: wide ? 3 : 1), alignment: .leading, spacing: 16) {
            ForEach(stats.prefix(3)) { stat in
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(stat.value)\(stat.suffix ?? "")")
                        .font(ElmFonts.display(size: 42, weight: .bold, relativeTo: .largeTitle)).foregroundStyle(ElmTheme.navyInk)
                        .elmLatin()
                    Text(stat.label).font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2)
                    if let path = stat.href, path.split(separator: "/").count >= 3 {
                        NavigationLink {
                            StoryDestination(seed: StoryCard(id: path, slug: path, section: "news", title: stat.label, excerpt: "", eyebrow: "بالأرقام", href: path))
                        } label: { Text("المصدر").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.navyInk) }
                    } else {
                        PublicPageLink(path: stat.href ?? "/infographics") { Text("المصدر").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.navyInk) }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(20)
                    .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 20))
            }
            }
        }
    }
}
