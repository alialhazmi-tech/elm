#if DEBUG
import Foundation

/// وسائط إطلاق للتطوير فقط: تفتح تبويبًا أو شاشة بعينها مباشرة،
/// فتصير لقطات المحاكي قابلة للتكرار بلا نقر يدوي.
///
///     xcrun simctl launch <sim> net.alelm.app -elmTab series
///     xcrun simctl launch <sim> net.alelm.app -elmScreen saved
enum ElmLaunch {
    enum Screen: String, Identifiable {
        case search, notifications, saved, membership, privacy, story, stories
        var id: String { rawValue }
    }

    private static let args = ProcessInfo.processInfo.arguments

    private static func value(_ key: String) -> String? {
        guard let index = args.firstIndex(of: key), index + 1 < args.count else { return nil }
        return args[index + 1]
    }

    static var tab: RootTab? { value("-elmTab").flatMap(RootTab.init(rawValue:)) }
    static var screen: Screen? { value("-elmScreen").flatMap(Screen.init(rawValue:)) }
}
#endif
