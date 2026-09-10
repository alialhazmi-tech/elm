import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// رموز العلم من app/soft.css، مع تباين مناسب للقراءة على iOS.
enum ElmTheme {
    static func dyn(
        _ light: (CGFloat, CGFloat, CGFloat, CGFloat),
        _ dark: (CGFloat, CGFloat, CGFloat, CGFloat)
    ) -> Color {
        #if canImport(UIKit)
        Color(uiColor: UIColor { trait in
            let c = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: c.3)
        })
        #else
        Color(red: light.0, green: light.1, blue: light.2, opacity: light.3)
        #endif
    }

    static func hex(_ value: String) -> Color {
        let hex = value.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        return Color(
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255
        )
    }

    /// رموز الهوية الحالية من app/soft.css. لون الأفعال منفصل عن خلفية الأزرار.
    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        func rgba(_ value: UInt32) -> (CGFloat, CGFloat, CGFloat, CGFloat) {
            (CGFloat((value >> 16) & 255) / 255, CGFloat((value >> 8) & 255) / 255, CGFloat(value & 255) / 255, 1)
        }
        return dyn(rgba(light), rgba(dark))
    }

    static var bg: Color { adaptive(0xfaf9f5, 0x0b1322) }
    static var surface: Color { adaptive(0xffffff, 0x0b1322) }
    static var surface2: Color { adaptive(0xf3efe8, 0x141f33) }
    static var surface3: Color { adaptive(0xeae4d9, 0x142a4d) }
    static var ink: Color { adaptive(0x141c24, 0xeaf0f8) }
    static var ink2: Color { adaptive(0x465362, 0xa9b7cc) }
    // الميتا الصغيرة تحتاج تباينًا أعلى من لون الموقع الخافت.
    static var ink3: Color { adaptive(0x596878, 0x9aa9bd) }
    static var line: Color { adaptive(0xe8e2d8, 0x1f2c44) }
    static var line2: Color { adaptive(0xd4ccc0, 0x33456a) }
    static let navy = hex("1a4282")
    static let navyDeep = hex("14356a")
    static var navyInk: Color { adaptive(0x1a4282, 0x8eb4ff) }
    static var accent: Color { navyInk }
    static var gold: Color { adaptive(0xb8923a, 0xd4b46a) }
    static let success = hex("2a9a6e")
    static let focus = hex("3d6fad")
    static var glass: Color { dyn((1, 1, 1, 0.96), (0.043, 0.075, 0.133, 0.96)) }
    static let danger = hex("c45468")
    static let teal = hex("2d9a8c")
    static var tealInk: Color { adaptive(0x21786d, 0x76d4c4) }

    static var spectrum: [Color] { SeriesPalette.active.map(\.color) }
    static var spectrumGradient: LinearGradient {
        LinearGradient(colors: spectrum, startPoint: .trailing, endPoint: .leading)
    }

    /// سكريم الصور: شفاف من الأعلى إلى كحلي داكن في الأسفل.
    static var scrim: LinearGradient {
        LinearGradient(
            // انحدار سريع: شريط أسفل داكن يكفي لقراءة العنوان، ثم تُترك الصورة ظاهرة.
            stops: [
                .init(color: navyDeep.opacity(0.92), location: 0.0),
                .init(color: navyDeep.opacity(0.76), location: 0.18),
                .init(color: navyDeep.opacity(0.28), location: 0.42),
                .init(color: navyDeep.opacity(0.0), location: 0.66),
            ],
            startPoint: .bottom,
            endPoint: .top
        )
    }

    /// زوايا الوسائط من --r-ui في هوية الموقع الحالية.
    static let radiusUI: CGFloat = 14
    static let radiusSm: CGFloat = 12
    static let radiusMd: CGFloat = 18
    static let radiusLg: CGFloat = 26
}

/// بطاقة «المنشور»: سطح + حدّ + ظل خفيف — تكرّرت في كل شاشة فاستُخرجت.
struct ElmCardStyle: ViewModifier {
    var radius: CGFloat = 16
    var padded: CGFloat? = nil
    var elevated: Bool = true

    func body(content: Content) -> some View {
        content
            .padding(padded ?? 0)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(ElmTheme.line, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(elevated ? 0.06 : 0), radius: 14, y: 5)
    }
}

extension View {
    func elmCard(radius: CGFloat = 16, padded: CGFloat? = nil, elevated: Bool = true) -> some View {
        modifier(ElmCardStyle(radius: radius, padded: padded, elevated: elevated))
    }

    /// أرقام لاتينية دائمًا داخل نص عربي — مقابل قاعدة `.latin-number`.
    func elmLatin() -> some View {
        environment(\.layoutDirection, .leftToRight)
            .monospacedDigit()
    }
}
