import SwiftUI

@main
struct ElmApp: App {
    @State private var library = LibraryStore()
    @State private var interests = InterestStore()
    @State private var appearance = AppearanceStore()
    @State private var member = MemberSessionStore()
    @State private var onboarding = OnboardingStore()
    @State private var connectivity = ConnectivityStore()
    @State private var narration = NarrationStore()

    init() {
        FontRegistration.registerAll()
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .elmRTL()
                .tint(ElmTheme.navy)
                .environment(library)
                .environment(interests)
                .environment(appearance)
                .environment(member)
                .environment(onboarding)
                .environment(connectivity)
                .environment(narration)
                .preferredColorScheme(appearance.colorScheme)
                .task { await member.restore() }
        }
    }
}
