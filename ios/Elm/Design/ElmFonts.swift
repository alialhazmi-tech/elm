import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Alexandria للعناوين، Readex Pro للمتن، Noto Kufi للوجوتايب — مع Dynamic Type.
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

    private static func scaled(name: String, style: Font.TextStyle, weight: Font.Weight) -> Font {
        #if canImport(UIKit)
        let uiStyle = uiTextStyle(style)
        let size = UIFont.preferredFont(forTextStyle: uiStyle).pointSize
        if let font = weightedUIFont(name: name, size: size, weight: uiWeight(weight)) {
            let scaled = UIFontMetrics(forTextStyle: uiStyle).scaledFont(for: font)
            return Font(scaled)
        }
        #endif
        return .custom(name, size: 17, relativeTo: style)
    }

    #if canImport(UIKit)
    private static func weightedUIFont(name: String, size: CGFloat, weight: UIFont.Weight) -> UIFont? {
        guard let base = UIFont(name: name, size: size) else { return nil }
        let descriptor = base.fontDescriptor.addingAttributes([
            .traits: [UIFontDescriptor.TraitKey.weight: weight],
        ])
        return UIFont(descriptor: descriptor, size: size)
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
