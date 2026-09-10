import SwiftUI

struct RootTabView: View {
    @State private var tab: RootTab = .home
    @Namespace private var tabIndicator
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(MemberSessionStore.self) private var member
    @Environment(ConnectivityStore.self) private var connectivity
    @Environment(NarrationStore.self) private var narration
    @Environment(ChromeState.self) private var chrome
    @Environment(StaffSessionStore.self) private var staff
    private let podcast = PodcastPlayerStore.shared
    private let summary = SummaryAudioStore.shared
    private let deepLinks = DeepLinkRouter.shared

    var body: some View {
        TabView(selection: $tab) {
            ForEach(RootTab.allCases) { item in
                NavigationStack {
                    screen(for: item)
                }
                .toolbar(.hidden, for: .tabBar)
                .tabItem { Text(item.label) }
                .tag(item)
            }
        }
        // وجهات ثابتة تحفظ مكدس التنقل لكل تبويب.
        .overlay(alignment: .bottom) {
            if !chrome.immersive && !chrome.readerVisible {
                ElmTabBar(selection: $tab, namespace: tabIndicator)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy(duration: 0.25), value: chrome.immersive)
        // لا لافتة فوق القارئ الغامر: تغطي شريط تقدم التقرير، والمحتوى محفوظ أصلًا.
        .overlay(alignment: .top) {
            if connectivity.isOffline && !chrome.immersive && !chrome.readerVisible {
                OfflinePill()
                    .padding(.top, 4)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottom) {
            if narration.state != .idle && !chrome.immersive && !chrome.readerVisible {
                NarrationBar()
                    .padding(.bottom, 78)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if summary.state != .idle && !chrome.immersive && !chrome.readerVisible {
                // الموجز الصوتي (الرئيسية أو مادة) يستمر أثناء التصفح ويظهر هنا كما يبقى `<audio>` على صفحة الويب.
                SummaryMiniBar()
                    .padding(.horizontal, 12)
                    .padding(.bottom, 82)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if podcast.isActive && !chrome.immersive && !chrome.readerVisible {
                // مشغّل البودكاست المصغّر فوق شريط التبويب في كل التبويبات؛ القارئ يعرض نسخته داخله.
                PodcastMiniBar()
                    .padding(.horizontal, 12)
                    .padding(.bottom, 82)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { onboarding.isPresented },
            set: { onboarding.isPresented = $0 }
        )) {
            OnboardingScreen().elmRTL()
        }
        .sheet(isPresented: Binding(
            get: { member.authPresented },
            set: { member.authPresented = $0 }
        )) {
            AuthSheet().elmRTL()
        }
        .fullScreenCover(isPresented: Binding(
            get: { staff.workspacePresented },
            set: { staff.workspacePresented = $0 }
        )) {
            StaffWorkspace().elmRTL()
        }
        .animation(.snappy, value: connectivity.isOffline)
        .animation(.snappy, value: narration.state)
        .animation(.snappy, value: podcast.isActive)
        .animation(.snappy, value: summary.state)
        // الرابط العميق يُدفع في مكدس الرئيسية؛ ننتقل إلى تبويبها ونغلق اللوحة إن كانت مفتوحة.
        .onChange(of: deepLinks.pending != nil) { _, hasRoute in
            if hasRoute { tab = .home; staff.workspacePresented = false }
        }
        .modifier(LaunchArgumentsModifier(tab: $tab))
    }

    @ViewBuilder
    private func screen(for tab: RootTab) -> some View {
        switch tab {
        case .home: HomeScreen()
        case .series: DiscoverScreen()
        case .ask: SearchScreen(showBack: false)
        case .forYou: ForYouScreen()
        case .account: AccountScreen()
        }
    }
}

/// يطبّق وسائط الإطلاق في نسخة التطوير فقط، ولا أثر له في الإصدار.
private struct LaunchArgumentsModifier: ViewModifier {
    @Binding var tab: RootTab
    @Environment(StaffSessionStore.self) private var staff

    #if DEBUG
    @State private var screen: ElmLaunch.Screen?

    func body(content: Content) -> some View {
        content
            .task {
                if let requested = ElmLaunch.tab { tab = requested }
                screen = ElmLaunch.screen
                if ElmLaunch.staffOpen { staff.workspacePresented = true }
                // `-elmSummaryPlay 1` بلا شاشة: يشغّل موجز الرئيسية ليظهر الشريط المصغّر العالمي في اللقطات.
                if ElmLaunch.summaryPlay, ElmLaunch.screen == nil { SummaryAudioStore.shared.toggle(.home) }
                if ElmLaunch.podcastPlay, ElmLaunch.screen == nil,
                   let entry = try? await APIClient.fetchPodcasts().shows.first, let episode = entry.episodes.first {
                    PodcastPlayerStore.shared.play(episode, from: entry.show)
                }
            }
            .fullScreenCover(item: $screen) { requested in
                NavigationStack {
                    switch requested {
                    case .search: SearchScreen()
                    case .notifications: NotificationsScreen()
                    case .saved: SavedScreen()
                    case .membership: MembershipScreen()
                    case .privacy: PrivacyScreen()
                    case .story: DebugStoryLoader(kind: .report)
                    case .article: DebugStoryLoader(kind: .article)
                    case .stories: DebugStoryLoader(kind: .stories)
                    case .podcasts: PodcastsScreen()
                    }
                }
                .elmRTL()
            }
    }
    #else
    func body(content: Content) -> some View { content }
    #endif
}

#if DEBUG
/// يجلب حزمة الرئيسية ثم يفتح المادة الرئيسية أو الموجز كقصص — للقطات فقط.
private struct DebugStoryLoader: View {
    enum Kind { case article, report, stories }
    let kind: Kind
    @State private var store = HomeStore()

    var body: some View {
        Group {
            if let home = store.payload {
                switch kind {
                case .article: StoryDetailScreen(seed: home.hero)
                case .report: StoryDestination(seed: firstReport(in: home))
                case .stories: StoriesScreen(items: home.brief)
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task { await store.load() }
    }

    /// الرئيسية لا تضع تقريرًا في الهيرو دائمًا — نبحث عن أول مادة بشكل jakalelm.
    private func firstReport(in home: MobileHomePayload) -> StoryCard {
        let pool = [home.hero] + home.minis + home.mosaic + home.mostRead + home.videos
        return pool.first { $0.format == JakFormat.slug } ?? home.hero
    }
}
#endif
