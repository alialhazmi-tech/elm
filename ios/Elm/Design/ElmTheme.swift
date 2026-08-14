import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// رموز «المنشور» — مشتقة حرفيًا من `app/globals.css` بالوضعين.
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

    // فاتح / داكن — القيم من :root و prefers-color-scheme: dark
    static var bg: Color { dyn((0.961, 0.969, 0.984, 1), (0.039, 0.075, 0.133, 1)) }          // #f5f7fb / #0a1322
    static var surface: Color { dyn((1, 1, 1, 1), (0.063, 0.110, 0.188, 1)) }                 // #ffffff / #101c30
    static var surface2: Color { dyn((0.933, 0.949, 0.973, 1), (0.086, 0.137, 0.227, 1)) }     // #eef2f8 / #16233a
    static var ink: Color { dyn((0.063, 0.118, 0.188, 1), (0.914, 0.937, 0.973, 1)) }          // #101e30 / #e9eff8
    static var ink2: Color { dyn((0.306, 0.373, 0.471, 1), (0.655, 0.714, 0.796, 1)) }         // #4e5f78 / #a7b6cb
    /// ميتا فقط — لا تستخدم لنص فقرة في الوضع الفاتح (تباين ~3.1:1).
    static var ink3: Color { dyn((0.518, 0.580, 0.671, 1), (0.443, 0.510, 0.608, 1)) }         // #8494ab / #71829b
    /// خطوط التفاصيل (صفوف داخل بلوك) — «الورقة المسطّرة» تفرّق بينها وبين حدود البلوكات.
    static var line: Color { dyn((0.906, 0.925, 0.957, 1), (0.118, 0.176, 0.275, 1)) }         // #e7ecf4 / #1e2d46
    /// خطوط البنية (حدود البلوكات والأقسام) — أثقل درجة من line عمدًا.
    static var line2: Color { dyn((0.780, 0.824, 0.886, 1), (0.208, 0.286, 0.424, 1)) }        // #c7d2e2 / #35496c
    static var navy: Color { dyn((0.071, 0.157, 0.294, 1), (0.086, 0.161, 0.290, 1)) }         // #12284b / #16294a
    static let navyDeep = hex("0b1a33")
    /// ذهب الطبعة التحريرية — عُمّق عن #f5b92e القديم ليصير مقروءًا AA فوق السطح.
    static var gold: Color { dyn((0.812, 0.604, 0.086, 1), (0.878, 0.678, 0.169, 1)) }         // #cf9a16 / #e0ad2b
    static let accent = hex("2B5C9E")
    static let success = hex("2eb873")
    static let focus = hex("3d7ef7")

    /// خلفية الأشرطة الزجاجية (رأس الشاشة وشريط التبويب).
    static var glass: Color { dyn((1, 1, 1, 0.82), (0.063, 0.110, 0.188, 0.86)) }
    /// كحلي مقروء فوق `surface2`: في الداكن يرتفع إلى #c7d6ee كما في `.day-strip-tag`.
    static var navyInk: Color { dyn((0.071, 0.157, 0.294, 1), (0.780, 0.839, 0.933, 1)) }

    static let danger = hex("ef476f")
    static let teal = hex("12b5a0")
    static let tealInk = hex("0e9083")

    /// طيف السلاسل الثماني بترتيب `series.ts` — يبدأ من جهة القراءة (اليمين).
    static let spectrum: [Color] = [
        hex("12b5a0"), hex("ef476f"), hex("eda313"), hex("3d7ef7"),
        hex("8b5cf6"), hex("14a8d6"), hex("f26a1b"), hex("c08a2e"),
    ]

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

    /// زوايا الوسائط في الطبعة التحريرية — شبه قائمة كما في `--r-ui: 4px`.
    static let radiusUI: CGFloat = 4
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
