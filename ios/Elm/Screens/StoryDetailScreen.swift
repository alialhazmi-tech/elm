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
    @Environment(\.dynamicTypeSize) private var typeSize
    @AppStorage("elm.reader.fontSize") private var fontSize = 17.0
    @State private var preferencesPresented = false
    /// الموجز التحريري مطويّ على ثلاثة أسطر افتراضيًا؛ النقر يعرضه كاملًا.
    @State private var dekExpanded = false
    @State private var readerID = UUID()

    @State private var detail: StoryDetailPayload?
    @State private var loading = false
    @State private var loadError: String?
    @State private var progress: Double = 0
    @State private var reportPresented = false
    @State private var linkCopied = false
    @State private var tracker = ReadingTracker()
    @State private var linkedStory: StoryCard?
    @State private var linkedKeyword: KeywordRoute?
    @State private var safari: SafariItem?
    /// 404 من الخادم: المادة حُذفت أو لم تعد منشورة — لا تُعرض بذرة البطاقة كمادة حية.
    @State private var notFound = false
    @State private var insights: StoryInsights?
    /// «نرشّح لك» من `/api/me/related` — مخصّصة للعضو، عامة للزائر.
    @State private var recommended: [RelatedItem]?
    @State private var personalized = false
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
    /// المشغّل المضمّن يحل محل الصورة البارزة كما على الويب (الخادم يرسله لمواد «فيديو» فقط).
    private var showsVideoEmbed: Bool {
        story.videoEmbedURL != nil && ["youtube", "x", "instagram"].contains(story.videoKind ?? "")
    }
    /// «التالي في السلسلة» — مواد السلسلة نفسها من `related` (حتى 3)، كما في جانب الويب.
    private var sameSeries: [StoryCard] {
        guard let series, let related = detail?.related else { return [] }
        return Array(related.filter { $0.series == series.slug }.prefix(3))
    }
    /// المقاطع بين العناوين — كل مقطع يبدأ بعنوان يحمل معرّف الفهرس `toc-N`.
    private var bodySegments: [[ArticleBlock]] {
        var segments: [[ArticleBlock]] = []
        for block in blocks {
            if block.type == "heading" || segments.isEmpty { segments.append([block]) }
            else { segments[segments.count - 1].append(block) }
        }
        return segments
    }
    /// فهرس «في هذه المادة» — يظهر عند عنوانين فأكثر كما على الويب.
    private var outline: [(id: String, title: String)] {
        bodySegments.enumerated().compactMap { index, segment in
            guard let first = segment.first, first.type == "heading" else { return nil }
            let title = first.plainText.trimmingCharacters(in: .whitespacesAndNewlines)
            return title.isEmpty ? nil : (id: "toc-\(index)", title: title)
        }
    }

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
                            if notFound {
                                unavailableView
                            } else {
                            articleOpening

                            // الموجز والعاجل يصنعان بطاقة بلا حقل الشكل، فقد تصل المادة هنا
                            // وهي تقرير — وهذا مدخله الغامر.
                            if !slides.isEmpty {
                                Button { reportPresented = true } label: {
                                    HStack(spacing: 9) {
                                        Image(systemName: "rectangle.stack.fill")
                                            .font(.system(.footnote, weight: .semibold))
                                        Text("شاهد التقرير كقصص")
                                            .font(ElmFonts.text(.footnote, weight: .bold))
                                        Spacer(minLength: 0)
                                        Text("\(ElmFormat.latinDigits(String(slides.count))) صفحة")
                                            .font(ElmFonts.text(.caption2))
                                            .opacity(0.75)
                                        Image(systemName: "arrow.left").font(.system(.caption2, weight: .bold))
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
                                factBlock(factCheck).padding(.top, 22)
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

                            if showsVideoEmbed, let embed = story.videoEmbedURL {
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
                            if outline.count >= 2 { outlineBlock(proxy).padding(.top, 22).id("reader-outline") }
                            body(of: story).padding(.top, 22).id("reader-body")
                            if detail != nil { readerTools.padding(.top, 32).id("reader-tools") }
                            if let insights {
                                insightsCard(insights).padding(.top, 28).id("reader-insights")
                            }
                            if let keywords = story.keywords, !keywords.isEmpty {
                                keywordChips(keywords).padding(.top, 28).id("reader-keywords")
                            }
                            if let links = story.links, !links.isEmpty {
                                linksBlock(links).padding(.top, 28)
                            }
                            PublicPageLink(path: story.path) {
                                Label("المادة الأصلية ومصادرها على الموقع", systemImage: "safari")
                                    .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 44)
                            }.padding(.top, 8)

                            // مادة البودكاست: بلا استفتاء/إعجاب كما على الويب.
                            if !story.isPodcast {
                                ArticleInteractionView(storyId: story.apiId)
                                    .id("\(story.apiId):\(member.user?.id ?? "guest")").padding(.top, 28)
                                    .id("reader-end")
                            }

                            if !sameSeries.isEmpty {
                                readAlso(sameSeries).padding(.top, 28)
                            }
                            let picks = recommendedCards
                            if !picks.isEmpty {
                                recommendedBlock(picks).padding(.top, 28).id("reader-recommended")
                            }
                            }
                        }
                        .frame(maxWidth: 640, alignment: .leading)
                        .padding(.horizontal, 22).padding(.top, 20).padding(.bottom, 40)
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
                    // لا شريط دائم أسفل القارئ: شريط الموجز الصوتي يظهر أثناء التجهيز/التشغيل فقط، وشريط البودكاست في مادته.
                    if !notFound {
                        VStack(spacing: 0) {
                            if showsPodcastBar { PodcastMiniBar() }
                            if SummaryAudioStore.shared.isActive(summaryKind) {
                                ReaderAudioBar(kind: summaryKind)
                                    .transition(.move(edge: .bottom).combined(with: .opacity))
                            }
                        }
                        .animation(.easeInOut(duration: 0.25), value: SummaryAudioStore.shared.isActive(summaryKind))
                    }
                }
                .toolbar(.hidden, for: .navigationBar)
                .task {
                    reading.markRead()
                    tracker.begin(storyId: seed.apiId, signedIn: member.isSignedIn)
                    SummaryAudioStore.shared.onStarted = { [tracker] kind in
                        if case .story(let id, _) = kind, id == seed.apiId { tracker.listened(signedIn: member.isSignedIn) }
                    }
                    await load()
                    if detail != nil, !notFound { await loadRecommended() }
                    #if DEBUG
                    if ElmLaunch.summaryPlay, detail != nil {
                        try? await Task.sleep(for: .milliseconds(500))
                        SummaryAudioStore.shared.toggle(summaryKind)
                        try? await Task.sleep(for: .seconds(1))
                        withAnimation(nil) { proxy.scrollTo("reader-tools", anchor: .center) }
                    }
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
            SummaryAudioStore.shared.stopIfCurrent(summaryKind)
            chrome.activeReaders.remove(readerID)
            // مغادرة الشاشة (رجوع أو دفع مادة أخرى فوقها) — النبضة الأخيرة، ثم يُستأنف العدّ عند العودة.
            tracker.end()
        }
        .onChange(of: progress) { _, value in tracker.update(progress: value) }
        // «مؤشرات المادة»: كل 60 ثانية ما دامت الشاشة ظاهرة؛ الفشل يخفي البطاقة بصمت.
        .task(id: "\(seed.apiId):\(notFound)") {
            guard !notFound else { return }
            while !Task.isCancelled {
                if let fresh = try? await APIClient.fetchInsights(storyId: seed.apiId) { insights = fresh }
                do { try await Task.sleep(for: .seconds(60)) } catch { return }
            }
        }
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
            ShareLink(item: story.shareURL) {
                Image(systemName: "square.and.arrow.up").frame(width: 44, height: 44)
            }.accessibilityLabel("مشاركة المادة").disabled(notFound)
            Menu {
                Button { preferencesPresented = true } label: { Label("حجم خط القراءة", systemImage: "textformat.size") }
                Divider()
                Button(action: toggleNarration) {
                    Label(isNarrating ? "إيقاف قراءة النص الكامل" : "قراءة النص الكامل بصوت الجهاز", systemImage: isNarrating ? "pause.fill" : "text.bubble")
                }
                if narration.storyId == story.apiId, narration.state != .idle {
                    Button { narration.stop() } label: { Label("إيقاف القراءة", systemImage: "stop.fill") }
                }
            } label: {
                Image(systemName: "ellipsis").frame(width: 44, height: 44)
            }
            .accessibilityLabel("خيارات القراءة").disabled(notFound)
        }
        .font(.system(.body, weight: .regular)).foregroundStyle(ElmTheme.ink2)
        .buttonStyle(.plain).padding(.horizontal, 8).padding(.vertical, 4)
        .background(ElmTheme.bg)
        .overlay {
            Image("OfficialLogo").resizable().scaledToFit().frame(width: 60, height: 32)
                .foregroundStyle(ElmTheme.ink).accessibilityLabel("العلم").allowsHitTesting(false)
        }
    }

    private var articleOpening: some View {
        VStack(alignment: .leading, spacing: 14) {
            kickerRow
            Text(story.title)
                .font(ElmFonts.display(size: 25, weight: .bold, relativeTo: .title2))
                .foregroundStyle(ElmTheme.ink).lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            dekBlock
            Rectangle().fill(ElmTheme.line).frame(height: 1).padding(.top, 2).accessibilityHidden(true)
            metaRow
            if story.isInfographic, story.imageURL != nil {
                // الإنفوجرافيك: الصورة هي المادة — كاملة بعرض الشاشة، والنقر يكبّرها.
                InfographicFigure(url: story.imageURL, title: story.title).padding(.top, 6).id("reader-figure")
            } else if story.imageURL != nil, !showsVideoEmbed {
                Color.clear.aspectRatio(16 / 9, contentMode: .fit)
                    .overlay { RemoteImage(url: story.imageURL) }
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusUI, style: .continuous))
                    .padding(.top, 6)
                    .accessibilityHidden(true)
            }
            if loading && detail == nil { ProgressView("جارٍ تحميل المادة").font(ElmFonts.text(.caption)) }
        }
    }

    /// مسار التصفح كما على الويب: شرطة السلسلة بلونها ثم القسم خافتًا؛ كلاهما رابط.
    private var kickerRow: some View {
        HStack(spacing: 8) {
            if let series {
                NavigationLink { SeriesFeedScreen(chip: series) } label: {
                    HStack(spacing: 7) {
                        RoundedRectangle(cornerRadius: 1, style: .continuous).fill(accent).frame(width: 14, height: 3)
                            .accessibilityHidden(true)
                        Text(series.name).font(ElmFonts.text(size: 12, weight: .bold, relativeTo: .caption)).foregroundStyle(accent).fixedSize()
                    }
                }.accessibilityLabel("سلسلة \(series.name)")
                Text("·").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).accessibilityHidden(true)
            }
            NavigationLink { BrowseFeedScreen(slug: story.section, title: ElmFormat.sectionName(story.section)) } label: {
                Text(ElmFormat.sectionName(story.section))
                    .font(ElmFonts.text(size: 12, weight: series == nil ? .bold : .medium, relativeTo: .caption))
                    .foregroundStyle(series == nil ? ElmTheme.navyInk : ElmTheme.ink3).fixedSize()
            }.accessibilityLabel("قسم \(ElmFormat.sectionName(story.section))")
            Spacer(minLength: 0)
        }.frame(minHeight: 28)
    }

    /// الموجز التحريري (dek): نص أخف من المتن وبثلاثة أسطر افتراضيًا؛ «المزيد» يعرضه كاملًا كما على الويب.
    @ViewBuilder
    private var dekBlock: some View {
        let dek = ElmReaderFormat.articleDek(story.excerpt)
        if !dek.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(dek)
                    .font(ElmFonts.text(size: 15.5, relativeTo: .subheadline))
                    .foregroundStyle(ElmTheme.ink2).lineSpacing(5)
                    .lineLimit(dekExpanded ? nil : 3)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("الموجز: \(dek)")
                if dek.count > 150 {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { dekExpanded.toggle() }
                    } label: {
                        HStack(spacing: 4) {
                            Text(dekExpanded ? "طيّ الموجز" : "الموجز كاملًا")
                            Image(systemName: dekExpanded ? "chevron.up" : "chevron.down").font(.system(size: 10, weight: .bold))
                        }
                        .font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                        .frame(minHeight: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(dekExpanded ? "طيّ الموجز" : "عرض الموجز كاملًا")
                }
            }
        }
    }

    /// سطر البيانات: الكاتب والتاريخ ووقت القراءة على اليمين، وزر «استمع للموجز» المضغوط على اليسار.
    private var metaRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            metaRowContent
            // خطأ الموجز الصوتي يظهر هنا لأن الشريط السفلي لا يُعرض إلا أثناء التجهيز/التشغيل.
            if SummaryAudioStore.shared.kind == summaryKind, let error = SummaryAudioStore.shared.errorMessage {
                Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.danger)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private var metaRowContent: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 12) {
                byline
                SummaryListenView(kind: summaryKind, compact: true).disabled(loading && detail == nil)
            }
        } else {
            // الزر يحتفظ بعرضه، وسطر التاريخ يلتف عند الحاجة بدل أن يدفع الزر إلى سطر مستقل.
            HStack(alignment: .center, spacing: 12) {
                byline.frame(maxWidth: .infinity, alignment: .leading)
                SummaryListenView(kind: summaryKind, compact: true).disabled(loading && detail == nil).layoutPriority(1)
            }
        }
    }

    private var byline: some View {
        HStack(spacing: 10) {
            Text("ع").font(ElmFonts.display(size: 14, weight: .heavy, relativeTo: .caption)).foregroundStyle(.white)
                .frame(width: 32, height: 32).background(ElmTheme.navy, in: Circle()).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("فريق العلم").font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                Text(metaLine).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).elmLatin()
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// «17 سبتمبر 2026، 03:30 بتوقيت الرياض · 4 دقائق قراءة» وسطر التحديث حين يتأخر فعلًا عن النشر.
    private var metaLine: String {
        var parts: [String] = []
        if let published = ElmReaderFormat.articleTimestamp(story.publishedAt) { parts.append("\(published) بتوقيت الرياض") }
        parts.append(ElmFormat.readingLabel(story.readingMinutes))
        var line = parts.joined(separator: " · ")
        if let updatedAt = ElmDates.parse(story.updatedAt), let publishedAt = ElmDates.parse(story.publishedAt),
           updatedAt > publishedAt, let updated = ElmReaderFormat.articleTimestamp(story.updatedAt) {
            line += "\nآخر تحديث: \(updated)"
        }
        return line
    }

    /// المادة لم تعد متاحة (404) — لا عنوان من البذرة كأنه مادة حية.
    private var unavailableView: some View {
        ContentUnavailableView {
            Label("المادة لم تعد متاحة", systemImage: "doc.questionmark")
        } description: {
            Text("ربما حُذفت أو لم تعد منشورة. يمكنك الرجوع ومتابعة القراءة من الرئيسية.")
        } actions: {
            Button { dismiss() } label: {
                Label("رجوع", systemImage: "arrow.right").font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 44)
            }
        }
        .padding(.top, 60)
    }

    /// «في هذه المادة» — النقر يمرّر إلى العنوان عبر معرّفات المقاطع.
    private func outlineBlock(_ proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "list.bullet").font(.system(.caption, weight: .semibold)).foregroundStyle(accent)
                Text("في هذه المادة").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            }.accessibilityElement(children: .combine).accessibilityAddTraits(.isHeader)
            ForEach(Array(outline.enumerated()), id: \.element.id) { index, entry in
                Button {
                    withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo(entry.id, anchor: .top) }
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(ElmFormat.latinDigits(String(index + 1))).font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(accent).frame(width: 18)
                        Text(entry.title).font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }.frame(minHeight: 36).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("الانتقال إلى: \(entry.title)")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// «مؤشرات المادة» — القرّاء والإكمال ومتوسط القراءة والإعجابات؛ النسب بعد 20 قارئًا كما على الويب.
    private func insightsCard(_ ins: StoryInsights) -> some View {
        let ready = ins.sampleReady
        let avg = ready ? ins.avgMinutes : Double(story.readingMinutes)
        let avgText = avg.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(avg)) : String(format: "%.1f", avg)
        return VStack(alignment: .leading, spacing: 12) {
            sectionHeading("مؤشرات المادة")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                insightTile(value: ElmFormat.latinDigits(String(ins.readers)), label: "قارئ")
                insightTile(value: ready ? "\(ElmFormat.latinDigits(String(ins.completion)))%" : "—", label: ready ? "إكمال القراءة" : "الإكمال بعد 20 قارئًا")
                insightTile(value: ElmFormat.latinDigits(avgText), label: ready ? "دقيقة متوسط القراءة" : "دقيقة قراءة متوقعة")
                insightTile(value: ElmFormat.latinDigits(String(ins.likes)), label: "إعجابًا")
            }
            Text("\(ElmFormat.latinDigits(String(ins.readers))) متصفح ضمن قياس القراءة\(ready ? "" : " · تظهر النسب بعد 20 قارئًا") · تتحدث كل دقيقة")
                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func insightTile(value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(ElmFonts.display(size: 24, weight: .bold, relativeTo: .title2)).foregroundStyle(ElmTheme.navyInk).elmLatin()
            Text(label).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }

    private var summaryKind: SummaryAudioKind { .story(id: story.apiId, title: story.title) }

    /// عنوان قسم بالطبعة التحريرية: خط بنية أعلى، نجمة ذهبية، عنوان عرض.
    private func sectionHeading(_ title: String, subtitle: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Rectangle().fill(ElmTheme.line2).frame(height: 1).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("✦").font(.system(size: 12)).foregroundStyle(ElmTheme.gold).accessibilityHidden(true)
                    Text(title).font(ElmFonts.display(.headline, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                }
                if let subtitle { Text(subtitle).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
            }
            .accessibilityElement(children: .combine).accessibilityAddTraits(.isHeader)
        }
    }

    /// «أدوات القارئ» كما على الويب: «لخّص لي» للأعضاء، المشاركة ونسخ الرابط.
    /// الموجز الصوتي له زره في رأس المادة وشريطه أسفل الشاشة أثناء التشغيل.
    private var readerTools: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeading("أدوات القارئ")
            ReaderAISummaryView(storyId: story.apiId)
            HStack(spacing: 10) {
                ShareLink(item: story.shareURL) {
                    Label("مشاركة", systemImage: "square.and.arrow.up").font(ElmFonts.text(.footnote, weight: .semibold)).frame(minHeight: 44)
                }
                Button {
                    UIPasteboard.general.string = story.shareURL.absoluteString
                    linkCopied = true
                    Task { try? await Task.sleep(for: .seconds(2)); linkCopied = false }
                } label: {
                    Label(linkCopied ? "نُسخ ✓" : "نسخ الرابط", systemImage: "link").font(ElmFonts.text(.footnote, weight: .semibold)).frame(minHeight: 44)
                }
            }
            .foregroundStyle(ElmTheme.navyInk)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
            // مقاطع بين العناوين حتى يقفز الفهرس إليها — `ArticleBodyView` لا يعرّف بلوكاته منفردة.
            VStack(alignment: .leading, spacing: 18) {
                ForEach(Array(bodySegments.enumerated()), id: \.offset) { index, segment in
                    ArticleBodyView(blocks: segment, fontSize: fontSize, accent: accent).id("toc-\(index)")
                }
            }
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
            // كل الحلقات كما على صفحة البرنامج في الويب — بلا سقف.
            PodcastEpisodeList(show: podcast.show, episodes: podcast.episodes)
        }
        .padding(14)
        .background(podcast.show.accentColor.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }

    private func keywordChips(_ keywords: [StoryKeyword]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeading("كلمات مفتاحية")
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
            sectionHeading("روابط وردت في المادة")
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
                                .font(.system(.footnote, weight: .semibold)).foregroundStyle(accent).frame(width: 20)
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
        VStack(alignment: .leading, spacing: 4) {
            sectionHeading(series.map { "اقرأ أيضًا في «\($0.name)»" } ?? "اقرأ أيضًا")
            ForEach(Array(related.prefix(3).enumerated()), id: \.element.id) { index, item in
                MiniStoryRow(story: item, first: index == 0)
            }
        }
    }

    /// بطاقات «نرشّح لك»: نتيجة `/api/me/related` إن وصلت، وإلا `detail.related` من سلاسل أخرى —
    /// وفي الحالين بلا ما سبق عرضه في «اقرأ أيضًا في السلسلة» (تعارض C-2).
    private var recommendedCards: [(card: StoryCard, reason: String?)] {
        let shown = Set(sameSeries.map(\.apiId) + [story.apiId])
        if let recommended {
            return recommended.map { (card: $0.asCard, reason: $0.reason?.text) }.filter { !shown.contains($0.card.apiId) }
        }
        return (detail?.related ?? []).filter { !shown.contains($0.apiId) }.map { (card: $0, reason: nil) }
    }

    private func recommendedBlock(_ items: [(card: StoryCard, reason: String?)]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionHeading("نرشّح لك", subtitle: personalized ? "مختارة لك بحسب قراءاتك" : "مواد أخرى قد تهمك")
            ForEach(Array(items.prefix(3).enumerated()), id: \.element.card.id) { index, item in
                VStack(alignment: .leading, spacing: 0) {
                    MiniStoryRow(story: item.card, first: index == 0)
                    if let reason = item.reason, !reason.isEmpty {
                        HStack(spacing: 6) {
                            Image(systemName: "sparkle").font(.system(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.gold)
                            Text(reason).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                        }
                        .padding(.bottom, 10)
                        .accessibilityLabel("لماذا: \(reason)")
                    }
                }
            }
        }
    }

    private func loadRecommended() async {
        guard let payload = try? await APIClient.fetchRelated(storyId: seed.apiId), !payload.items.isEmpty else { return }
        recommended = payload.items
        personalized = payload.personalized
        ImageStore.shared.prefetch(payload.items.compactMap { $0.asCard.imageURL })
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
        } catch APIClientError.badStatus(404) {
            notFound = true
            detail = nil
        } catch ElmAPIError.notFound {
            notFound = true
            detail = nil
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
