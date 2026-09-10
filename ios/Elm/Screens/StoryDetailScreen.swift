import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// 1b — قارئ المادة: مؤشر تقدّم بطيف السلاسل، الشائعة/الحقيقة قبل المتن،
/// استفتاء الختام، وشريط أدوات القراءة.
struct StoryDetailScreen: View {
    let seed: StoryCard

    @Environment(LibraryStore.self) private var library
    @Environment(NarrationStore.self) private var narration
    @Environment(MemberSessionStore.self) private var member
    @Environment(ReadingStore.self) private var reading
    @Environment(ChromeState.self) private var chrome
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("elm.reader.fontSize") private var fontSize = 17.0
    @State private var preferencesPresented = false
    @State private var readerID = UUID()

    @State private var detail: StoryDetailPayload?
    @State private var loading = false
    @State private var loadError: String?
    @State private var progress: Double = 0
    @State private var reportPresented = false
    @State private var tracker = ReadingTracker()
    @State private var linkedStory: StoryCard?
    @State private var linkedKeyword: KeywordRoute?
    @State private var safari: SafariItem?
    private let podcastPlayer = PodcastPlayerStore.shared

    private var story: StoryCard { detail?.story.inheritingVideo(from: seed) ?? seed }
    private var series: SeriesChip? { detail?.series ?? seed.series.flatMap { Self.chip(for: $0) } }
    private var factCheck: FactCheck? { detail?.factCheck ?? story.factCheck }
    private var slides: [StorySlide] { detail?.slides ?? [] }
    private var accent: Color { series.map { ElmTheme.hex($0.color) } ?? ElmTheme.accent }
    private var blocks: [ArticleBlock] { story.articleBlocks }
    private var podcast: PodcastBundle? { detail?.podcast }
    /// شريط البودكاست المصغّر يظهر في مادة البرنامج فقط (الربط العالمي بانتظار RootTabView).
    private var showsPodcastBar: Bool { podcast != nil && podcastPlayer.isActive }

    var body: some View {
        GeometryReader { _ in
            ScrollViewReader { proxy in
                VStack(spacing: 0) {
                    readerHeader
                    GeometryReader { line in
                        Rectangle().fill(ElmTheme.navyInk)
                            .frame(width: line.size.width * progress)
                    }.frame(height: 2).background(ElmTheme.line).accessibilityHidden(true)
                    GeometryReader { scrollViewport in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            articleOpening

                            // الموجز والعاجل يصنعان بطاقة بلا حقل الشكل، فقد تصل المادة هنا
                            // وهي تقرير — وهذا مدخله الغامر.
                            if !slides.isEmpty {
                                Button { reportPresented = true } label: {
                                    HStack(spacing: 9) {
                                        Image(systemName: "rectangle.stack.fill")
                                            .font(.system(size: 13, weight: .semibold))
                                        Text("شاهد التقرير كقصص")
                                            .font(ElmFonts.text(.footnote, weight: .bold))
                                        Spacer(minLength: 0)
                                        Text("\(ElmFormat.latinDigits(String(slides.count))) صفحة")
                                            .font(ElmFonts.text(.caption2))
                                            .opacity(0.75)
                                        Image(systemName: "arrow.left").font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 12)
                                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .padding(.top, 16)
                            }

                            if let factCheck {
                                factBlock(factCheck).padding(.top, 18)
                            }

                            if let loadError {
                                Label(loadError, systemImage: "arrow.down.circle")
                                    .font(ElmFonts.text(.footnote, weight: .medium))
                                    .foregroundStyle(ElmTheme.ink2)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    .padding(.top, 16)
                            }

                            if let embed = story.videoEmbedURL, ["youtube", "x", "instagram"].contains(story.videoKind ?? "") {
                                VideoEmbedView(embedURL: embed, originalURL: story.videoURL, kind: story.videoKind)
                                    .padding(.top, 16)
                            } else if let videoURL = story.videoURL {
                                Button { safari = SafariItem(url: videoURL) } label: {
                                    Label("شغّل الفيديو", systemImage: "play.circle.fill")
                                        .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 48)
                                }.buttonStyle(.plain).padding(.top, 16)
                            } else if story.format == "videos" || story.section == "videos", detail != nil {
                                PublicPageLink(path: story.path) {
                                    Label("شغّل الفيديو", systemImage: "play.circle.fill")
                                        .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 48)
                                }.padding(.top, 16)
                            }
                            if let podcast {
                                podcastBlock(podcast).padding(.top, 18).id("reader-podcast")
                            } else if story.format == "podcasts", detail != nil {
                                NavigationLink { PodcastsScreen() } label: {
                                    Label("استمع إلى البرنامج", systemImage: "headphones")
                                        .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 48)
                                }.buttonStyle(.plain).padding(.top, 16)
                            }
                            body(of: story).padding(.top, 18).id("reader-body")
                            if let updated = updatedLine {
                                Text(updated).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).padding(.top, 14)
                            }
                            if let keywords = story.keywords, !keywords.isEmpty {
                                keywordChips(keywords).padding(.top, 18).id("reader-keywords")
                            }
                            if let links = story.links, !links.isEmpty {
                                linksBlock(links).padding(.top, 18)
                            }
                            PublicPageLink(path: story.path) {
                                Label("المادة الأصلية ومصادرها", systemImage: "safari")
                                    .font(ElmFonts.text(.footnote)).frame(minHeight: 44)
                            }.padding(.top, 12)


                            ArticleInteractionView(storyId: story.apiId)
                                .id("\(story.apiId):\(member.user?.id ?? "guest")").padding(.top, 22)
                                .id("reader-end")

                            if let related = detail?.related, !related.isEmpty {
                                readAlso(related).padding(.top, 22)
                            }
                        }
                        .frame(maxWidth: 640, alignment: .leading)
                        .padding(.horizontal, 24).padding(.top, 24).padding(.bottom, 28)
                        .frame(maxWidth: .infinity)
                        .reportsScroll()
                    }
                    .modifier(ReaderScrollProgress(progress: $progress))
                    .coordinateSpace(name: ElmScrollSpace.name)
                    .scrollDismissesKeyboard(.interactively)
                    .onPreferenceChange(ElmScrollKey.self) { metrics in
                        if #available(iOS 18.0, *) { } else {
                            let scrollable = max(1, metrics.contentHeight - scrollViewport.size.height)
                            progress = max(0, min(1, Double(metrics.offset / scrollable)))
                        }
                    }
                    }
                }
                .background(ElmTheme.bg.ignoresSafeArea())
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    VStack(spacing: 0) {
                        if showsPodcastBar { PodcastMiniBar() }
                        readerDock
                    }
                }
                .toolbar(.hidden, for: .navigationBar)
                .task {
                    reading.markRead()
                    tracker.begin(storyId: seed.apiId, signedIn: member.isSignedIn)
                    await load()
                    #if DEBUG
                    if let section = ElmLaunch.homeSection, section.hasPrefix("reader-") {
                        try? await Task.sleep(for: .seconds(1.5))
                        withAnimation(nil) { proxy.scrollTo(section, anchor: .top) }
                    }
                    #endif
                }
            }
        }
        .onAppear {
            chrome.activeReaders.insert(readerID)
            tracker.begin(storyId: seed.apiId, signedIn: member.isSignedIn)
        }
        .onDisappear {
            chrome.activeReaders.remove(readerID)
            // مغادرة الشاشة (رجوع أو دفع مادة أخرى فوقها) — النبضة الأخيرة، ثم يُستأنف العدّ عند العودة.
            tracker.end()
        }
        .onChange(of: progress) { _, value in tracker.update(progress: value) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { tracker.resume() } else { tracker.pause() }
        }
        .environment(\.openURL, OpenURLAction { url in
            switch ElmLinks.route(url) {
            case .story(let card): linkedStory = card
            case .keyword(let keyword): linkedKeyword = KeywordRoute(keyword: keyword)
            case .external(let external): safari = SafariItem(url: external)
            }
            return .handled
        })
        .navigationDestination(item: $linkedStory) { card in StoryDestination(seed: card) }
        .navigationDestination(item: $linkedKeyword) { route in KeywordScreen(keyword: route.keyword) }
        .sheet(item: $safari) { item in SafariSheet(url: item.url).ignoresSafeArea() }
        .sheet(isPresented: $preferencesPresented) { readerPreferences.elmRTL() }
        .fullScreenCover(isPresented: $reportPresented) {
            JakReportScreen(seed: story).elmRTL()
        }
    }

    private var readerHeader: some View {
        HStack(spacing: 6) {
            Button { dismiss() } label: {
                Image(systemName: "arrow.right").frame(width: 44, height: 44)
            }.accessibilityLabel("رجوع")
            Spacer()
            Button { library.toggle(story) } label: {
                Image(systemName: library.contains(story) ? "bookmark.fill" : "bookmark").frame(width: 44, height: 44)
            }.accessibilityLabel(library.contains(story) ? "إزالة من المحفوظات" : "حفظ المادة")
            ShareLink(item: URLConstants.publicURL(path: story.path)) {
                Image(systemName: "square.and.arrow.up").frame(width: 44, height: 44)
            }.accessibilityLabel("مشاركة المادة")
        }
        .font(.system(size: 18, weight: .regular)).foregroundStyle(ElmTheme.ink2)
        .buttonStyle(.plain).padding(.horizontal, 12).padding(.vertical, 4)
        .background(ElmTheme.bg)
        .overlay {
            Image("OfficialLogo").resizable().scaledToFit().frame(width: 60, height: 32)
                .foregroundStyle(ElmTheme.ink).accessibilityLabel("العلم").allowsHitTesting(false)
        }
    }

    private var articleOpening: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                if let series {
                    NavigationLink { SeriesFeedScreen(chip: series) } label: {
                        HStack(spacing: 6) {
                            Circle().fill(accent).frame(width: 6, height: 6)
                            Text(series.name).fixedSize()
                        }.font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                    }.accessibilityLabel("سلسلة \(series.name)")
                }
                Text(ElmFormat.sectionName(story.section)).font(ElmFonts.text(.subheadline)).foregroundStyle(ElmTheme.ink2)
            }.frame(minHeight: 28)
            Text(story.title)
                .font(ElmFonts.display(size: 25, weight: .semibold, relativeTo: .title2))
                .foregroundStyle(ElmTheme.ink).lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            ViewThatFits(in: .horizontal) {
                HStack { author; Spacer(); readingMeta }
                VStack(alignment: .leading, spacing: 8) { author; readingMeta }
            }
            if story.imageURL != nil {
                Color.clear.aspectRatio(1.95, contentMode: .fit)
                    .overlay { RemoteImage(url: story.imageURL) }
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.top, 4)
            }
            if loading && detail == nil { ProgressView("جاري تحميل المادة").font(ElmFonts.text(.caption)) }
        }.padding(.bottom, 8)
    }

    private var author: some View {
        HStack(spacing: 8) {
            Image("OfficialLogo").resizable().scaledToFit().frame(width: 24, height: 18)
                .padding(8).background(ElmTheme.surface2, in: Circle()).accessibilityHidden(true)
            Text("تحرير العلم").font(ElmFonts.text(.caption, weight: .medium))
        }.foregroundStyle(ElmTheme.ink2)
    }

    private var readingMeta: some View {
        Label(ElmFormat.readingLabel(story.readingMinutes), systemImage: "clock")
            .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
    }

    private var readerDock: some View {
        HStack(spacing: 14) {
            Button(action: toggleNarration) {
                Label(isNarrating ? "إيقاف مؤقت" : "استمع للمادة", systemImage: isNarrating ? "pause.fill" : "headphones")
                    .font(ElmFonts.text(.subheadline, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .foregroundStyle(.white).background(ElmTheme.navy, in: Capsule())
            }.disabled(loading && detail == nil)
            Button { preferencesPresented = true } label: {
                Image(systemName: "textformat.size.ar").font(.system(size: 22)).frame(width: 48, height: 48)
            }.accessibilityLabel("حجم خط القراءة")
            Text("\(Int(progress * 100))٪")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                .accessibilityLabel("قرأت \(Int(progress * 100)) بالمئة")
                .frame(minWidth: 34)
        }.buttonStyle(.plain).foregroundStyle(ElmTheme.ink)
            .padding(.horizontal, 22).padding(.vertical, 10)
            .background { ElmTheme.bg.ignoresSafeArea(edges: .bottom).shadow(color: .black.opacity(0.04), radius: 12, y: -4) }
    }

    private var readerPreferences: some View {
        ScrollView {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("حجم خط القراءة").font(ElmFonts.display(.title3, weight: .semibold))
                Spacer()
                Button("تم") { preferencesPresented = false }.font(ElmFonts.text(.body, weight: .semibold))
            }
            Text("اختر الحجم الأنسب لقراءتك.").font(ElmFonts.text(size: fontSize)).foregroundStyle(ElmTheme.ink)
            Picker("حجم الخط", selection: $fontSize) {
                Text("عادي").tag(17.0)
                Text("كبير").tag(20.0)
                Text("أكبر").tag(23.0)
            }.pickerStyle(.segmented)
            Text("يحترم التطبيق أيضًا حجم الخط الذي اخترته في إعدادات الجهاز.")
                .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
        }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }.background(ElmTheme.bg).presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
    }

    private func toggleNarration() {
        if narration.storyId == story.apiId { narration.toggle() }
        else {
            let paragraphs = ArticleBlocks.paragraphs(blocks)
            narration.start(story: story, paragraphs: paragraphs.isEmpty ? ElmFormat.bodyParagraphs(story.body ?? "") : paragraphs)
            tracker.listened(signedIn: member.isSignedIn)
        }
    }

    private var updatedLine: String? {
        guard let updated = story.updatedAt, updated != story.publishedAt,
              let label = ElmFormat.brandDate(updated) else { return nil }
        return "حُدّثت المادة في \(label)"
    }

    // MARK: أجزاء

    @ViewBuilder
    private func body(of story: StoryCard) -> some View {
        if !slides.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(slides) { slide in slideCard(slide) }
            }
        } else if blocks.isEmpty {
            Text(story.excerpt.isEmpty ? "متن هذه المادة غير متاح الآن." : story.excerpt)
                .font(ElmFonts.text(size: fontSize))
                .foregroundStyle(ElmTheme.ink)
                .lineSpacing(5)
        } else {
            ArticleBodyView(blocks: blocks, fontSize: fontSize, accent: accent)
        }
    }

    private func podcastBlock(_ podcast: PodcastBundle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Color.clear.frame(width: 56, height: 56)
                    .overlay { RemoteImage(url: podcast.show.coverURL, maxPixel: 300) }
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(podcast.show.name).font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                    Text(podcast.episodes.isEmpty ? "تعذر جلب الحلقات الآن" : ElmFormat.countedNoun(podcast.episodes.count, one: "حلقة واحدة", two: "حلقتان", few: "حلقات", many: "حلقة"))
                        .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                }
                Spacer(minLength: 0)
                NavigationLink { PodcastsScreen() } label: {
                    Text("كل البرامج").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 44)
                }.buttonStyle(.plain)
            }
            PodcastEpisodeList(show: podcast.show, episodes: podcast.episodes, limit: 8)
        }
        .padding(14)
        .background(podcast.show.accentColor.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }

    private func keywordChips(_ keywords: [StoryKeyword]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("كلمات مفتاحية").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            ElmFlow(spacing: 8) {
                ForEach(keywords) { item in
                    NavigationLink { KeywordScreen(keyword: item.keyword) } label: {
                        Text(item.keyword)
                            .font(ElmFonts.text(.footnote, weight: .medium))
                            .foregroundStyle(ElmTheme.ink)
                            .padding(.horizontal, 12).frame(minHeight: 36)
                            .background(ElmTheme.surface2, in: Capsule())
                            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("كلمة مفتاحية: \(item.keyword)")
                }
            }
        }
    }

    private func linksBlock(_ links: [StoryLink]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("روابط وردت في المادة").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            ForEach(links) { link in
                if let url = link.url {
                    Button {
                        switch ElmLinks.route(url) {
                        case .story(let card): linkedStory = card
                        case .keyword(let keyword): linkedKeyword = KeywordRoute(keyword: keyword)
                        case .external(let external): safari = SafariItem(url: external)
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: ElmLinks.isElmHost(url.host) ? "doc.text" : "link")
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(accent).frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(link.label.isEmpty ? (url.host ?? link.href) : link.label)
                                    .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                                    .multilineTextAlignment(.leading)
                                Text(url.host ?? link.href).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).elmLatin().lineLimit(1)
                            }
                            Spacer(minLength: 0)
                        }
                        .frame(minHeight: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("رابط: \(link.label)")
                }
            }
        }
    }

    private func factBlock(_ fact: FactCheck) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                Text("الشائعة")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.danger)
                Text(fact.rumor)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .background(ElmTheme.danger.opacity(0.09))

            Divider().overlay(ElmTheme.line)

            VStack(alignment: .leading, spacing: 5) {
                Text("✓ الحقيقة — دقّقها العلم")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.tealInk)
                Text(fact.truth)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .background(ElmTheme.teal.opacity(0.09))
        }
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("الشائعة: \(fact.rumor). الحقيقة: \(fact.truth)")
    }

    private func readAlso(_ related: [StoryCard]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(series.map { "اقرأ أيضًا في «\($0.name)»" } ?? "اقرأ أيضًا")
                .font(ElmFonts.display(.headline, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            ForEach(related.prefix(3)) { item in
                MiniStoryRow(story: item)
            }
        }
    }

    private func slideCard(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let url = slide.imageURL {
                RemoteImage(url: url, height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            if let stat = slide.stat, !stat.isEmpty {
                Text(ElmFormat.latinDigits(stat))
                    .font(ElmFonts.display(.largeTitle, weight: .heavy))
                    .foregroundStyle(accent)
                    .elmLatin()
                if let label = slide.statLabel, !label.isEmpty {
                    Text(label)
                        .font(ElmFonts.text(.footnote, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                }
            }
            if !slide.title.isEmpty {
                Text(slide.title)
                    .font(ElmFonts.display(.title3, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
            }
            if !slide.body.isEmpty {
                Text(ElmFormat.latinDigits(slide.body))
                    .font(ElmFonts.text(.callout))
                    .foregroundStyle(ElmTheme.ink)
                    .lineSpacing(7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: أدوات

    private var isNarrating: Bool {
        narration.storyId == story.apiId && narration.state == .playing
    }

    private func load() async {
        loading = true
        defer { loading = false }
        loadError = nil
        do {
            let fresh = try await APIClient.fetchStory(id: seed.apiId)
            detail = fresh
            AppCache.saveStory(fresh)
            var urls = [fresh.story.imageURL].compactMap { $0 }
            urls.append(contentsOf: (fresh.slides ?? []).compactMap(\.imageURL))
            urls.append(contentsOf: fresh.related.compactMap(\.imageURL))
            if let cover = fresh.podcast?.show.coverURL { urls.append(cover) }
            ImageStore.shared.prefetch(urls)
        } catch {
            if let cached = AppCache.loadStory(id: seed.apiId) {
                detail = cached
                loadError = "أنت تقرأ نسخة محفوظة من هذه المادة."
            } else if (seed.body ?? "").isEmpty {
                loadError = "تعذر تحميل متن المادة. جرّب مجددًا عند عودة الاتصال."
            }
        }
    }

    private static func chip(for slug: String) -> SeriesChip? {
        guard let swatch = SeriesPalette.active.first(where: { $0.id == slug }) else { return nil }
        return SeriesChip(slug: swatch.id, name: swatch.name, description: "", color: swatch.colorHex)
    }
}

/// وجهة كلمة مفتاحية من رابط داخل المتن.
struct KeywordRoute: Hashable {
    let keyword: String
}

/// Use the scroll view's own geometry on supported systems; retain the iOS 17 measurement above.
private struct ReaderScrollProgress: ViewModifier {
    @Binding var progress: Double
    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollGeometryChange(for: Double.self) { geometry in
                let length = geometry.contentSize.height - geometry.containerSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom
                return length > 0 ? max(0, min(1, Double((geometry.contentOffset.y + geometry.contentInsets.top) / length))) : 0
            } action: { _, value in progress = value }
        } else { content }
    }
}
