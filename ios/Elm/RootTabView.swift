import SwiftUI

struct RootTabView: View {
    @State private var tab: RootTab = .home
    @Namespace private var tabIndicator
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(MemberSessionStore.self) private var member
    @Environment(ConnectivityStore.self) private var connectivity
    @Environment(NarrationStore.self) private var narration

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
        // شريط التبويب النظامي مخفي: الشرطة الذهبية فوق الأيقونة النشطة
        // علامة العلم، ولا يمكن رسمها داخل الشريط النظامي.
        .overlay(alignment: .bottom) {
            ElmTabBar(selection: $tab, namespace: tabIndicator)
        }
        .overlay(alignment: .top) {
            if connectivity.isOffline {
                OfflinePill()
                    .padding(.top, 4)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottom) {
            if narration.state != .idle {
                NarrationBar()
                    .padding(.bottom, 78)
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
        .animation(.snappy, value: connectivity.isOffline)
        .animation(.snappy, value: narration.state)
        .modifier(LaunchArgumentsModifier(tab: $tab))
    }

    @ViewBuilder
    private func screen(for tab: RootTab) -> some View {
        switch tab {
        case .home: HomeScreen()
        case .series: SeriesScreen()
        case .ask: AskScreen()
        case .forYou: ForYouScreen()
        case .account: AccountScreen()
        }
    }
}

/// يطبّق وسائط الإطلاق في نسخة التطوير فقط، ولا أثر له في الإصدار.
private struct LaunchArgumentsModifier: ViewModifier {
    @Binding var tab: RootTab

    #if DEBUG
    @State private var screen: ElmLaunch.Screen?

    func body(content: Content) -> some View {
        content
            .task {
                if let requested = ElmLaunch.tab { tab = requested }
                screen = ElmLaunch.screen
            }
            .fullScreenCover(item: $screen) { requested in
                NavigationStack {
                    switch requested {
                    case .search: SearchScreen()
                    case .notifications: NotificationsScreen()
                    case .saved: SavedScreen()
                    case .membership: MembershipScreen()
                    case .privacy: PrivacyScreen()
                    case .story: DebugStoryLoader(kind: .article)
                    case .stories: DebugStoryLoader(kind: .stories)
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
    enum Kind { case article, stories }
    let kind: Kind
    @State private var store = HomeStore()

    var body: some View {
        Group {
            if let home = store.payload {
                switch kind {
                case .article: StoryDetailScreen(seed: home.hero)
                case .stories: StoriesScreen(items: home.brief)
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task { await store.load() }
    }
}
#endif
