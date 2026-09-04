import SwiftUI
import Observation

enum AppearanceMode: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var label: String {
        switch self {
        case .system: "تلقائي"
        case .light: "فاتح"
        case .dark: "داكن"
        }
    }
}

@MainActor
@Observable
final class AppearanceStore {
    private let modeKey = "elm.appearance.v1"
    private var personalizationKey = "elm.personalization.v1"

    var mode: AppearanceMode {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: modeKey) }
    }

    var personalizationEnabled: Bool = true {
        didSet { UserDefaults.standard.set(personalizationEnabled, forKey: personalizationKey) }
    }

    var colorScheme: ColorScheme? { mode.colorScheme }

    func switchAccount(_ id: String?) {
        personalizationKey = id.map { "elm.personalization.member.\($0)" } ?? "elm.personalization.v1"
        personalizationEnabled = UserDefaults.standard.object(forKey: personalizationKey) == nil ? true : UserDefaults.standard.bool(forKey: personalizationKey)
    }

    init() {
        if let raw = UserDefaults.standard.string(forKey: modeKey), let parsed = AppearanceMode(rawValue: raw) {
            mode = parsed
        } else {
            mode = .system
        }
        if UserDefaults.standard.object(forKey: personalizationKey) == nil {
            personalizationEnabled = true
        } else {
            personalizationEnabled = UserDefaults.standard.bool(forKey: personalizationKey)
        }
    }
}
