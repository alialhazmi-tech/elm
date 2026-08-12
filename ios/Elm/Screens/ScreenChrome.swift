import SwiftUI

struct ScreenChrome<Content: View>: View {
    let title: String
    let spec: String
    let content: Content

    init(title: String, spec: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.spec = spec
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(spec)
                    .font(ElmFonts.text(.caption, weight: .semibold))
                    .foregroundStyle(ElmTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(ElmTheme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .accessibilityLabel("رقم النموذج \(spec)")
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
    }
}
