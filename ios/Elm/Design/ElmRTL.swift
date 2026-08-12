import SwiftUI

private struct ElmRTLModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar-SA@calendar=gregorian;numbers=latn"))
            .multilineTextAlignment(.leading)
    }
}

extension View {
    func elmRTL() -> some View {
        modifier(ElmRTLModifier())
    }
}
