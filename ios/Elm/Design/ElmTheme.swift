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
    static var line: Color { dyn((0.886, 0.910, 0.945, 1), (0.125, 0.188, 0.290, 1)) }         // #e2e8f1 / #20304a
    static var line2: Color { dyn((0.827, 0.863, 0.914, 1), (0.165, 0.235, 0.345, 1)) }        // #d3dce9 / #2a3c58
    static var navy: Color { dyn((0.071, 0.157, 0.294, 1), (0.086, 0.161, 0.290, 1)) }         // #12284b / #16294a
    static let navyDeep = hex("0b1a33")
    /// تمييز فقط — ممنوع نصًا على أبيض (تباين ~1.8:1).
    static let gold = hex("f5b92e")
    static let accent = hex("2B5C9E")
    static let success = hex("2eb873")
    static let focus = hex("3d7ef7")

    static let radiusSm: CGFloat = 12
    static let radiusMd: CGFloat = 18
    static let radiusLg: CGFloat = 26
}
