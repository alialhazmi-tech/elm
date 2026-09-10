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
    @State private var staff = StaffSessionStore()

    init() {
        FontRegistration.registerAll()
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .elmRTL()
                .tint(ElmTheme.navyInk)
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
                .environment(staff)
                .preferredColorScheme(appearance.colorScheme)
                .task { await member.restore() }
                .task { await staff.restore() }
                .task(id: member.user?.id) { await library.switchAccount(member.user?.id) }
                .task(id: member.user?.id) { await interests.switchAccount(member.user?.id, appearance: appearance) }
        }
    }
}
