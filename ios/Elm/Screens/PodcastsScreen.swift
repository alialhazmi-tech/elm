import SwiftUI

@MainActor
@Observable
final class PodcastsStore {
    private static let cacheKey = "podcasts.v1"
    var shows: [PodcastShowEntry] = []
    var loading = false
    var errorMessage: String?
    var fromCache = false

    func load() async {
        if shows.isEmpty, let cached = AppCache.load(Self.cacheKey),
           let payload = try? JSONDecoder().decode(PodcastsPayload.self, from: cached.data) {
            shows = payload.shows
            fromCache = true
        }
        loading = shows.isEmpty
        errorMessage = nil
        do {
            let (data, _) = try await ElmHTTP.request(ElmHTTP.url(URLConstants.contentAPI, "api/mobile/v1/podcasts"))
            let payload = try ElmHTTP.decode(PodcastsPayload.self, from: data)
            shows = payload.shows
            fromCache = false
            AppCache.save(data, key: Self.cacheKey)
            ImageStore.shared.prefetch(shows.compactMap(\.show.coverURL), maxPixel: 600)
        } catch {
            errorMessage = ElmAPIError.wrap(error).message
        }
        loading = false
    }
}

/// بودكاست العلم: البرامج بأغلفتها ثم حلقات البرنامج المختار — تشغيل أصلي بلا Safari.
struct PodcastsScreen: View {
    @State private var store = PodcastsStore()
    @State private var selected: String?
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    private let player = PodcastPlayerStore.shared

    private var current: PodcastShowEntry? {
        store.shows.first { $0.id == selected } ?? store.shows.first
    }

    /// «أحدث الحلقات» عبر كل البرامج — أحدث 3 من كل برنامج ثم أحدث 5 إجمالًا، كما على الويب.
    private var latestAcrossShows: [(show: PodcastShow, episode: PodcastEpisode)] {
        store.shows
            .flatMap { entry in entry.episodes.prefix(3).map { (show: entry.show, episode: $0) } }
            .sorted { ($0.episode.publishedAt ?? "") > ($1.episode.publishedAt ?? "") }
            .prefix(5)
            .map { $0 }
    }

    var body: some View {
        ElmScreen(title: "بودكاست", showBack: true, bottomInset: player.isActive ? 160 : 92, onRefresh: { await store.load() }) {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("بودكاست العلم").font(ElmFonts.display(.largeTitle, weight: .bold)).foregroundStyle(ElmTheme.ink)
                    Text("برامج العلم وحلقاتها — تشغيل داخل التطبيق ويستمر في الخلفية.")
                        .font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2).lineSpacing(4)
                }
                if store.fromCache, store.errorMessage == nil {
                    Text("تُعرض آخر نسخة محفوظة. اسحب للتحديث.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
                }
                if let error = store.errorMessage, store.shows.isEmpty {
                    ContentUnavailableView {
                        Label("تعذر تحميل البودكاست", systemImage: "wifi.slash")
                    } description: { Text(error) } actions: {
                        Button("إعادة المحاولة") { Task { await store.load() } }.frame(minHeight: 44)
                    }
                } else if store.loading && store.shows.isEmpty {
                    ProgressView("جارٍ تحميل البرامج").font(ElmFonts.text(.caption)).frame(maxWidth: .infinity).padding(.top, 40)
                } else if store.shows.isEmpty {
                    ContentUnavailableView("لا برامج منشورة بعد", systemImage: "headphones")
                } else {
                    showsRail
                    let latest = latestAcrossShows
                    if store.shows.count > 1, !latest.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHead(title: "أحدث الحلقات", subtitle: "من كل البرامج")
                            VStack(spacing: 8) {
                                ForEach(latest, id: \.episode.id) { item in
                                    PodcastEpisodeRow(show: item.show, episode: item.episode, showsName: true)
                                }
                            }
                        }
                    }
                    if let current { episodes(of: current) }
                }
                if let error = store.errorMessage, !store.shows.isEmpty {
                    Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                }
            }
            .padding(20)
            .frame(maxWidth: sizeClass == .regular ? 900 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task {
            await store.load()
            #if DEBUG
            if ElmLaunch.podcastPlay, let entry = store.shows.first, let episode = entry.episodes.first, !player.isActive {
                player.play(episode, from: entry.show)
            }
            #endif
        }
    }

    private var showsRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 14) {
                ForEach(store.shows) { entry in
                    let active = entry.id == current?.id
                    Button { selected = entry.id } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Color.clear.aspectRatio(1, contentMode: .fit)
                                .overlay { RemoteImage(url: entry.show.coverURL, maxPixel: 600) }
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(active ? entry.show.accentColor : .clear, lineWidth: 3))
                            Text(entry.show.name).font(ElmFonts.display(.subheadline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                                .lineLimit(2).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            Text(ElmFormat.countedNoun(entry.episodes.count, one: "حلقة واحدة", two: "حلقتان", few: "حلقات", many: "حلقة"))
                                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                        }
                        // عرض مرن مع تكبير النص حتى لا يُقصّ اسم البرنامج.
                        .frame(width: typeSize.isAccessibilitySize ? 200 : 132)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("برنامج \(entry.show.name)")
                    .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func episodes(of entry: PodcastShowEntry) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                SectionHead(title: entry.show.name, subtitle: "الحلقات الأحدث أولًا")
                if let youtube = entry.show.youtube, let url = URL(string: youtube) {
                    Link(destination: url) {
                        Image(systemName: "play.rectangle").font(.system(.body)).frame(width: 44, height: 44)
                    }.accessibilityLabel("قناة البرنامج على يوتيوب").foregroundStyle(ElmTheme.ink2)
                }
            }
            if entry.episodes.isEmpty {
                Text("تعذر جلب حلقات هذا البرنامج الآن.").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
            } else {
                PodcastEpisodeList(show: entry.show, episodes: entry.episodes)
            }
        }
    }
}

/// قائمة حلقات — تُستخدم في شاشة البودكاست وفي مادة البرنامج داخل القارئ.
struct PodcastEpisodeList: View {
    let show: PodcastShow
    let episodes: [PodcastEpisode]
    var limit: Int? = nil
    private let player = PodcastPlayerStore.shared

    var body: some View {
        VStack(spacing: 8) {
            ForEach(limit.map { Array(episodes.prefix($0)) } ?? episodes) { episode in
                PodcastEpisodeRow(show: show, episode: episode)
            }
        }
        if let error = player.errorMessage {
            Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.danger)
        }
    }
}

struct PodcastEpisodeRow: View {
    let show: PodcastShow
    let episode: PodcastEpisode
    /// اسم البرنامج فوق العنوان — للصفوف المجمّعة عبر البرامج.
    var showsName = false
    private let player = PodcastPlayerStore.shared

    private var isCurrent: Bool { player.isCurrent(episode) }
    private var symbol: String {
        guard isCurrent else { return "play.fill" }
        switch player.state {
        case .playing: return "pause.fill"
        case .loading: return "ellipsis"
        default: return "play.fill"
        }
    }

    var body: some View {
        Button { player.play(episode, from: show) } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(isCurrent ? show.accentColor : ElmTheme.navy, in: Circle())
                VStack(alignment: .leading, spacing: 5) {
                    if showsName {
                        Text(show.name).font(ElmFonts.text(.caption2, weight: .bold)).foregroundStyle(show.accentColor)
                    }
                    Text(episode.title)
                        .font(ElmFonts.text(.subheadline, weight: isCurrent ? .bold : .medium))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 8) {
                        if let date = ElmFormat.brandDate(episode.publishedAt) { Text(date) }
                        if let duration = ElmFormat.durationLabel(episode.duration) {
                            Text("·").accessibilityHidden(true)
                            Text(duration).elmLatin()
                        }
                    }
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                    if let description = episode.description, !description.isEmpty, isCurrent {
                        Text(description).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineLimit(4).lineSpacing(3)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(isCurrent ? show.accentColor.opacity(0.08) : ElmTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(isCurrent && player.state == .playing ? "إيقاف" : "تشغيل") الحلقة: \(episode.title)\(showsName ? "، من \(show.name)" : "")")
    }
}

/// شريط المشغّل المصغّر — يُعرض داخل شاشة البودكاست وقارئ مادة البرنامج.
/// (ربطه عالميًا فوق شريط التبويب يحتاج تعديل `RootTabView` — خارج نطاق هذا التسليم.)
struct PodcastMiniBar: View {
    private let player = PodcastPlayerStore.shared
    @State private var scrubbing = false
    @State private var scrubValue: Double = 0

    var body: some View {
        if let episode = player.episode {
            VStack(spacing: 6) {
                HStack(spacing: 12) {
                    Color.clear.frame(width: 44, height: 44)
                        .overlay { RemoteImage(url: player.show?.coverURL, maxPixel: 200) }
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(episode.title).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink).lineLimit(1)
                        Text(timeLine).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).elmLatin()
                    }
                    Spacer(minLength: 0)
                    Button { player.skip(-15) } label: {
                        Image(systemName: "gobackward.15").font(.system(.body)).frame(width: 40, height: 44)
                    }.accessibilityLabel("رجوع 15 ثانية")
                    Button { player.toggle() } label: {
                        Group {
                            if player.state == .loading { ProgressView().tint(.white) }
                            else { Image(systemName: player.state == .playing ? "pause.fill" : "play.fill").font(.system(.body, weight: .bold)) }
                        }
                        .foregroundStyle(.white).frame(width: 44, height: 44).background(ElmTheme.navy, in: Circle())
                    }.accessibilityLabel(player.state == .playing ? "إيقاف مؤقت" : "تشغيل")
                    Button { player.stop() } label: {
                        Image(systemName: "xmark").font(.system(.footnote, weight: .semibold)).frame(width: 36, height: 44)
                    }.accessibilityLabel("إغلاق المشغّل")
                }
                .buttonStyle(.plain).foregroundStyle(ElmTheme.ink2)
                Slider(
                    value: Binding(get: { scrubbing ? scrubValue : player.currentTime }, set: { scrubValue = $0 }),
                    in: 0...max(1, player.duration)
                ) { editing in
                    scrubbing = editing
                    if !editing { player.seek(to: scrubValue) }
                }
                .tint(player.show?.accentColor ?? ElmTheme.navyInk)
                .accessibilityLabel("موضع التشغيل")
                .accessibilityValue(timeLine)
            }
            .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 6)
            .background(ElmTheme.glass.background(.ultraThinMaterial))
            .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private var timeLine: String {
        let now = ElmFormat.clock(Int(scrubbing ? scrubValue : player.currentTime))
        guard player.duration > 0 else { return now }
        return "\(now) / \(ElmFormat.clock(Int(player.duration)))"
    }
}
