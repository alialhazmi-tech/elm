import SwiftUI

/// الشريط العلوي الزجاجي المشترك — الهوية يمينًا، وأدوات القارئ يسارًا.
/// يحل محل شريط التنقل النظامي حتى يبقى وجه التطبيق واحدًا في كل شاشة.
struct ElmHeader: View {
    var title: String = ""
    var showBrand: Bool = false
    var showBack: Bool = false
    var showTools: Bool = true

    @Environment(\.dismiss) private var dismiss
    @Environment(AppearanceStore.self) private var appearance
    @Environment(\.colorScheme) private var colorScheme
    @Binding var route: HeaderRoute?

    init(
        title: String = "",
        showBrand: Bool = false,
        showBack: Bool = false,
        showTools: Bool = true,
        route: Binding<HeaderRoute?> = .constant(nil)
    ) {
        self.title = title
        self.showBrand = showBrand
        self.showBack = showBack
        self.showTools = showTools
        _route = route
    }

    var body: some View {
        HStack(spacing: 10) {
            if showBack {
                circleButton(label: "رجوع") { dismiss() } content: {
                    Image(systemName: "arrow.right").font(.system(size: 14, weight: .semibold))
                }
            }

            if showBrand {
                brand
            }

            Spacer(minLength: 6)

            if !title.isEmpty {
                Text(title)
                    .font(ElmFonts.text(.caption2, weight: .medium))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(1)
            }

            if showTools {
                circleButton(label: "البحث") { route = .search } content: {
                    Image(systemName: "magnifyingglass").font(.system(size: 14, weight: .semibold))
                }
                circleButton(label: "تبديل الوضع اللوني", action: toggleTheme) {
                    Image(systemName: isDark ? "moon.fill" : "sun.max.fill")
                        .font(.system(size: 13, weight: .semibold))
                }
                circleButton(label: "الإشعارات") { route = .notifications } content: {
                    Image(systemName: "bell").font(.system(size: 14, weight: .medium))
                }
                .overlay(alignment: .topLeading) {
                    Circle()
                        .fill(ElmTheme.danger)
                        .frame(width: 7, height: 7)
                        .overlay(Circle().stroke(ElmTheme.glass, lineWidth: 1.5))
                        .offset(x: 1, y: 4)
                        .accessibilityHidden(true)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 6)
        .padding(.bottom, 10)
        .background {
            ElmTheme.glass
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .top)
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(ElmTheme.line).frame(height: 1)
        }
    }

    private var brand: some View {
        HStack(spacing: 9) {
            Text("العلم")
                .font(ElmFonts.logo(.title3))
                .foregroundStyle(ElmTheme.ink)
            Rectangle()
                .fill(ElmTheme.line2)
                .frame(width: 1, height: 18)
            Text("المعرفة\nبسلاسة")
                .font(ElmFonts.text(.caption2))
                .foregroundStyle(ElmTheme.ink3)
                .lineSpacing(-1)
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("العلم، المعرفة بسلاسة")
        .accessibilityAddTraits(.isHeader)
    }

    private var isDark: Bool {
        switch appearance.mode {
        case .dark: true
        case .light: false
        case .system: colorScheme == .dark
        }
    }

    private func toggleTheme() {
        appearance.mode = isDark ? .light : .dark
    }

    private func circleButton<Content: View>(
        label: String,
        action: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        Button(action: action) {
            content()
                .foregroundStyle(ElmTheme.ink2)
                .frame(width: 34, height: 34)
                .background(ElmTheme.surface2, in: Circle())
                .overlay(Circle().stroke(ElmTheme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// وجهات يفتحها الرأس — تُدار من الشاشة المضيفة حتى تبقى داخل مكدسها.
enum HeaderRoute: Hashable, Identifiable {
    case search, notifications
    var id: Self { self }
}
