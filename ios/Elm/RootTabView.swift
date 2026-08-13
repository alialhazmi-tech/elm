import SwiftUI

enum RootTab: Hashable {
    case home, series, forYou, search, account
}

struct RootTabView: View {
    @State private var tab: RootTab = .home
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(MemberSessionStore.self) private var member
    @Environment(ConnectivityStore.self) private var connectivity
    @Environment(NarrationStore.self) private var narration

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack {
                HomeScreen()
            }
            .tabItem {
                Label("الرئيسية", systemImage: "house.fill")
            }
            .tag(RootTab.home)
            .accessibilityLabel("الرئيسية، النموذج 1أ")

            NavigationStack {
                SeriesScreen()
            }
            .tabItem {
                Label("السلاسل", systemImage: "square.grid.2x2.fill")
            }
            .tag(RootTab.series)
            .accessibilityLabel("السلاسل، النموذج 1ب")

            NavigationStack {
                ForYouScreen()
            }
            .tabItem {
                Label("لك", systemImage: "sparkles")
            }
            .tag(RootTab.forYou)
            .accessibilityLabel("لك، النموذج 1و")

            NavigationStack {
                SearchScreen()
            }
            .tabItem {
                Label("بحث", systemImage: "magnifyingglass")
            }
            .tag(RootTab.search)
            .accessibilityLabel("بحث، النموذج 1هـ")

            NavigationStack {
                AccountScreen()
            }
            .tabItem {
                Label("حسابي", systemImage: "person.crop.circle")
            }
            .tag(RootTab.account)
            .accessibilityLabel("حسابي، النموذج 1ز")
        }
        .tint(ElmTheme.navy)
        .overlay(alignment: .top) {
            if connectivity.isOffline {
                OfflinePill().padding(.top, 4).transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottom) {
            if narration.state != .idle {
                NarrationBar()
                    .padding(.bottom, 62)
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
            MembershipScreen().elmRTL()
        }
        .animation(.snappy, value: connectivity.isOffline)
        .animation(.snappy, value: narration.state)
    }
}
