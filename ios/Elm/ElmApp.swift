import SwiftUI

@main
struct ElmApp: App {
    @State private var library = LibraryStore()
    @State private var interests = InterestStore()
    @State private var appearance = AppearanceStore()

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
                .preferredColorScheme(appearance.colorScheme)
        }
    }
}
