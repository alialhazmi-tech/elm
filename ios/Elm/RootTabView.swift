import SwiftUI

enum RootTab: Hashable {
    case home, series, forYou, search, account
}

struct RootTabView: View {
    @State private var tab: RootTab = .home

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack {
                HomeScreen()
            }
            .elmDestinations()
            .tabItem {
                Label("الرئيسية", systemImage: "house.fill")
            }
            .tag(RootTab.home)
            .accessibilityLabel("الرئيسية، النموذج 1أ")

            NavigationStack {
                SeriesScreen()
            }
            .elmDestinations()
            .tabItem {
                Label("السلاسل", systemImage: "square.grid.2x2.fill")
            }
            .tag(RootTab.series)
            .accessibilityLabel("السلاسل، النموذج 1ب")

            NavigationStack {
                ForYouScreen()
            }
            .elmDestinations()
            .tabItem {
                Label("لك", systemImage: "sparkles")
            }
            .tag(RootTab.forYou)
            .accessibilityLabel("لك، النموذج 1و")

            NavigationStack {
                SearchScreen()
            }
            .elmDestinations()
            .tabItem {
                Label("بحث", systemImage: "magnifyingglass")
            }
            .tag(RootTab.search)
            .accessibilityLabel("بحث، النموذج 1هـ")

            NavigationStack {
                AccountScreen()
            }
            .elmDestinations()
            .tabItem {
                Label("حسابي", systemImage: "person.crop.circle")
            }
            .tag(RootTab.account)
            .accessibilityLabel("حسابي، النموذج 1ز")
        }
        .tint(ElmTheme.navy)
    }
}
