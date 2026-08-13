import SwiftUI
import CoreText
#if canImport(UIKit)
import UIKit
#endif

/// Alexandria للعناوين، Readex Pro للمتن، Noto Kufi للوجوتايب — مع Dynamic Type.
/// الملفات المضمّنة خطوط متغيرة؛ الوزن يُضبط عبر محور `wght` لا عبر Trait على Regular،
/// لأن Trait يُبقي الوجه Regular في العربية فيظهر النص رفيعًا رغم طلب Bold/Heavy.
enum ElmFonts {
    static let display = "Alexandria-Regular"
    static let text = "ReadexPro-Regular"
    static let logo = "NotoKufiArabic-Regular"

    static func display(_ style: Font.TextStyle, weight: Font.Weight = .bold) -> Font {
        scaled(name: display, style: style, weight: weight)
    }

    static func text(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        scaled(name: text, style: style, weight: weight)
    }

    static func logo(_ style: Font.TextStyle) -> Font {
        scaled(name: logo, style: style, weight: .black)
    }

    /// مقاس صريح بالنقاط مع بقاء Dynamic Type — لسطوح تصميمها يحدد الحجم لا نمط النص،
    /// مثل صفحات تقارير «جاك العلم» حيث الرقم 113 نقطة والعنوان 34.
    static func display(size: CGFloat, weight: Font.Weight = .heavy, relativeTo style: Font.TextStyle = .title) -> Font {
        sized(name: display, size: size, weight: weight, style: style)
    }

    static func text(size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        sized(name: text, size: size, weight: weight, style: style)
    }

    #if canImport(UIKit)
    static func uiFont(named name: String, size: CGFloat, weight: Font.Weight) -> UIFont? {
        weightedUIFont(name: name, size: size, weight: uiWeight(weight))
    }
    #endif

    private static func sized(name: String, size: CGFloat, weight: Font.Weight, style: Font.TextStyle) -> Font {
        #if canImport(UIKit)
        if let font = weightedUIFont(name: name, size: size, weight: uiWeight(weight)) {
            return Font(UIFontMetrics(forTextStyle: uiTextStyle(style)).scaledFont(for: font))
        }
        #endif
        return .custom(name, size: size, relativeTo: style)
    }

    private static func scaled(name: String, style: Font.TextStyle, weight: Font.Weight) -> Font {
        #if canImport(UIKit)
        let uiStyle = uiTextStyle(style)
        // لا تستخدم preferredFont.pointSize هنا: هو مكبّر أصلًا حسب Dynamic Type،
        // وتمريره إلى UIFontMetrics يكرر التكبير مرتين في أحجام الوصول.
        let size = basePointSize(style)
        if let font = weightedUIFont(name: name, size: size, weight: uiWeight(weight)) {
            let scaled = UIFontMetrics(forTextStyle: uiStyle).scaledFont(for: font)
            return Font(scaled)
        }
        #endif
        return .custom(name, size: 17, relativeTo: style)
    }

    #if canImport(UIKit)
    /// محور الوزن في ملفات Google المتغيرة — 'wght' كعدد كبير-endian.
    private static let wghtAxisTag: Int = 0x77676874
    private static let variationAttribute = UIFontDescriptor.AttributeName(
        rawValue: kCTFontVariationAttribute as String
    )

    private static func weightedUIFont(name: String, size: CGFloat, weight: UIFont.Weight) -> UIFont? {
        guard let base = UIFont(name: name, size: size) else { return nil }
        let wght = axisWeight(weight, fontName: name, base: base)
        // ابنِ واصفًا من العائلة لا من PostScript Regular؛ إضافة Trait على Regular
        // لا تحرّك محور wght في خطوط Google العربية المتغيرة.
        let descriptor = UIFontDescriptor(fontAttributes: [
            .family: base.familyName,
            .size: size,
            variationAttribute: [NSNumber(value: wghtAxisTag): NSNumber(value: Double(wght))],
        ])
        return UIFont(descriptor: descriptor, size: size)
    }

    private static func axisWeight(_ weight: UIFont.Weight, fontName: String, base: UIFont) -> CGFloat {
        var requested: CGFloat
        switch weight {
        case .ultraLight: requested = 200
        case .thin: requested = 100
        case .light: requested = 300
        case .regular: requested = 400
        case .medium: requested = 500
        case .semibold: requested = 600
        case .bold: requested = 700
        case .heavy: requested = 800
        case .black: requested = 900
        default: requested = 400 + weight.rawValue * 500
        }

        let ctFont = base as CTFont
        guard let axes = CTFontCopyVariationAxes(ctFont) as? [[String: Any]] else {
            return fontName.contains("Readex") ? min(requested, 700) : requested
        }
        let axis = axes.first { item in
            (item[kCTFontVariationAxisIdentifierKey as String] as? NSNumber)?.intValue == wghtAxisTag
        } ?? axes.first
        let minW = (axis?[kCTFontVariationAxisMinimumValueKey as String] as? NSNumber)?.doubleValue ?? 100
        let maxW = (axis?[kCTFontVariationAxisMaximumValueKey as String] as? NSNumber)?.doubleValue ?? 900
        return CGFloat(min(max(Double(requested), minW), maxW))
    }

    private static func uiTextStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {
        switch style {
        case .largeTitle: return .largeTitle
        case .title: return .title1
        case .title2: return .title2
        case .title3: return .title3
        case .headline: return .headline
        case .subheadline: return .subheadline
        case .body: return .body
        case .callout: return .callout
        case .footnote: return .footnote
        case .caption: return .caption1
        case .caption2: return .caption2
        default: return .body
        }
    }

    private static func basePointSize(_ style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .subheadline: return 15
        case .body: return 17
        case .callout: return 16
        case .footnote: return 13
        case .caption: return 12
        case .caption2: return 11
        default: return 17
        }
    }

    private static func uiWeight(_ weight: Font.Weight) -> UIFont.Weight {
        switch weight {
        case .ultraLight: return .ultraLight
        case .thin: return .thin
        case .light: return .light
        case .regular: return .regular
        case .medium: return .medium
        case .semibold: return .semibold
        case .bold: return .bold
        case .heavy: return .heavy
        case .black: return .black
        default: return .regular
        }
    }
    #endif
}
