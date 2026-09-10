import SwiftUI

/// الشريط العلوي الزجاجي المشترك — الهوية يمينًا، وأدوات القارئ يسارًا.
/// يحل محل شريط التنقل النظامي حتى يبقى وجه التطبيق واحدًا في كل شاشة.
struct ElmHeader: View {
    var title: String = ""
    var showBrand: Bool = false
    var showBack: Bool = false
    var showTools: Bool = true

    @Environment(\.dismiss) private var dismiss
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
                    .font(ElmFonts.text(.subheadline, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineLimit(1)
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            }

            if showTools {
                if showBrand {
                    circleButton(label: "المحفوظات") { route = .saved } content: {
                        Image(systemName: "bookmark").font(.system(size: 17, weight: .medium))
                    }
                    circleButton(label: "الإشعارات") { route = .notifications } content: {
                        Image(systemName: "bell").font(.system(size: 17, weight: .medium))
                    }
                } else if !showBack {
                    circleButton(label: "البحث") { route = .search } content: {
                        Image(systemName: "magnifyingglass").font(.system(size: 16, weight: .medium))
                    }
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
        Image("OfficialLogo")
            .resizable()
            .scaledToFit()
            .foregroundStyle(ElmTheme.ink)
            .frame(width: 82, height: 44)
            .accessibilityLabel("العلم")
            .accessibilityAddTraits(.isHeader)
    }

    private func circleButton<Content: View>(
        label: String,
        action: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        Button(action: action) {
            content()
                .foregroundStyle(ElmTheme.ink2)
                .frame(width: 44, height: 44)
                .background(showBrand ? Color.clear : ElmTheme.surface2, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// وجهات يفتحها الرأس — تُدار من الشاشة المضيفة حتى تبقى داخل مكدسها.
enum HeaderRoute: Hashable, Identifiable {
    case search, notifications, browse, saved
    var id: Self { self }
}
