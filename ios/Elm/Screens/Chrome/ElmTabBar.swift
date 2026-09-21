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
        case .series: "استكشف"
        case .ask: "البحث"
        case .forYou: "لك أنت"
        case .account: "حسابي"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .series: "square.grid.2x2"
        case .ask: "magnifyingglass"
        case .forYou: "heart"
        case .account: "person"
        }
    }
}

/// تبويبات بهوية العلم: لون أزرق وأيقونة ممتلئة للوجهة النشطة.
struct ElmTabBar: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                                    .fill(ElmTheme.navyInk)
                                    .frame(width: 18, height: 3)
                                    .matchedGeometryEffect(id: "elmTabDot", in: namespace)
                            } else {
                                Color.clear.frame(height: 3)
                            }
                        }
                        .frame(height: 3)

                        Image(systemName: selection == tab && tab != .ask ? "\(tab.symbol).fill" : tab.symbol)
                            .font(.system(size: 20, weight: selection == tab ? .semibold : .regular))
                            .frame(width: 48, height: 28)
                            .background(selection == tab ? ElmTheme.surface3 : .clear, in: Capsule())
                        Text(tab.label)
                            .font(ElmFonts.text(.caption2, weight: .medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    }
                    .foregroundStyle(selection == tab ? ElmTheme.navyInk : ElmTheme.ink2)
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
        .animation(reduceMotion ? nil : .snappy(duration: 0.22), value: selection)
    }
}
