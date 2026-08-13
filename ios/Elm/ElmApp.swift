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
    @State private var polls = PollStore()
    @State private var notifPrefs = NotificationPrefs()
    @State private var reading = ReadingStore()
    @State private var chrome = ChromeState()

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
                .environment(polls)
                .environment(notifPrefs)
                .environment(reading)
                .environment(chrome)
                .preferredColorScheme(appearance.colorScheme)
                .task { await member.restore() }
        }
    }
}
