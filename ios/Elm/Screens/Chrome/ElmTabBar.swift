import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

enum RootTab: String, Hashable, CaseIterable, Identifiable {
    case home, series, ask, forYou, account
    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: "الرئيسية"
        case .series: "السلاسل"
        case .ask: "اسأل"
        case .forYou: "لك أنت"
        case .account: "حسابي"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .series: "square.grid.2x2"
        case .ask: "sparkle"
        case .forYou: "heart"
        case .account: "person"
        }
    }
}

/// شريط التبويب الزجاجي — الشرطة الذهبية فوق الأيقونة النشطة هي علامة العلم،
/// ولا يمكن الحصول عليها من شريط TabView النظامي، فبُني الشريط يدويًا فوقه.
struct ElmTabBar: View {
    @Binding var selection: RootTab
    var namespace: Namespace.ID

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(RootTab.allCases) { tab in
                Button {
                    #if canImport(UIKit)
                    if selection != tab { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
                    #endif
                    selection = tab
                } label: {
                    VStack(spacing: 4) {
                        ZStack {
                            if selection == tab {
                                RoundedRectangle(cornerRadius: 2, style: .continuous)
                                    .fill(ElmTheme.gold)
                                    .frame(width: 18, height: 3)
                                    .matchedGeometryEffect(id: "elmTabDot", in: namespace)
                            } else {
                                Color.clear.frame(height: 3)
                            }
                        }
                        .frame(height: 3)

                        Image(systemName: tab.symbol)
                            .font(.system(size: 19, weight: selection == tab ? .semibold : .regular))
                            .frame(height: 23)
                        Text(tab.label)
                            .font(ElmFonts.text(.caption2, weight: .medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .foregroundStyle(selection == tab ? ElmTheme.ink : ElmTheme.ink3)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
                .accessibilityAddTraits(selection == tab ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.top, 8)
        .padding(.horizontal, 6)
        .padding(.bottom, 4)
        .background {
            ElmTheme.glass
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            Rectangle().fill(ElmTheme.line).frame(height: 1)
        }
        .animation(.snappy(duration: 0.22), value: selection)
    }
}
