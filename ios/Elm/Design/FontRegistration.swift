import SwiftUI
import CoreText
#if canImport(UIKit)
import UIKit
#endif

enum FontRegistration {
    private static var didRegister = false

    static func registerAll() {
        guard !didRegister else { return }
        didRegister = true
        ["Alexandria", "ReadexPro", "NotoKufiArabic"].forEach { registerFont(named: $0, ext: "ttf") }
        applyChromeAppearance()
    }

    private static func applyChromeAppearance() {
        #if canImport(UIKit)
        if let tabFont = weighted(name: ElmFonts.text, size: 10, weight: .semibold) {
            UITabBarItem.appearance().setTitleTextAttributes([.font: tabFont], for: .normal)
            UITabBarItem.appearance().setTitleTextAttributes([.font: tabFont], for: .selected)
        }
        if let navFont = weighted(name: ElmFonts.display, size: 17, weight: .bold),
           let largeFont = weighted(name: ElmFonts.display, size: 30, weight: .black) {
            UINavigationBar.appearance().titleTextAttributes = [.font: navFont]
            UINavigationBar.appearance().largeTitleTextAttributes = [.font: largeFont]
        }
        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = UIColor(ElmTheme.surface)
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
        UITabBar.appearance().tintColor = UIColor(ElmTheme.navy)
        UITabBar.appearance().unselectedItemTintColor = UIColor(ElmTheme.ink3)
        #endif
    }

    #if canImport(UIKit)
    private static func weighted(name: String, size: CGFloat, weight: Font.Weight) -> UIFont? {
        ElmFonts.uiFont(named: name, size: size, weight: weight)
    }
    #endif

    private static func registerFont(named filename: String, ext: String) {
        guard let url = Bundle.main.url(forResource: filename, withExtension: ext) else {
            #if DEBUG
            print("[ElmFonts] missing bundled file: \(filename).\(ext)")
            #endif
            return
        }
        var error: Unmanaged<CFError>?
        let ok = CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        if !ok {
            #if DEBUG
            print("[ElmFonts] failed to register \(filename): \(error?.takeRetainedValue().localizedDescription ?? "unknown")")
            #endif
        }
    }
}
