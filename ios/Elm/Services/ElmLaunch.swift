#if DEBUG
import Foundation

/// وسائط إطلاق للتطوير فقط: تفتح تبويبًا أو شاشة بعينها مباشرة،
/// فتصير لقطات المحاكي قابلة للتكرار بلا نقر يدوي.
///
///     xcrun simctl launch <sim> net.alelm.app -elmTab series
///     xcrun simctl launch <sim> net.alelm.app -elmScreen saved
enum ElmLaunch {
    enum Screen: String, Identifiable {
        case search, notifications, saved, membership, privacy, story, article, stories, podcasts
        var id: String { rawValue }
    }

    private static let args = ProcessInfo.processInfo.arguments

    private static func value(_ key: String) -> String? {
        guard let index = args.firstIndex(of: key), index + 1 < args.count else { return nil }
        return args[index + 1]
    }

    static var homeSection: String? { value("-elmHomeSection") }
    /// `-elmStory <id>` يفتح مادة بعينها من تبويب الرئيسية (لقطات المتن الغني والفيديو).
    static var storyId: String? { value("-elmStory") }
    /// `-elmStoryVideo <embedUrl>` يزرع مشغّل يوتيوب في بذرة المادة لمعاينة `VideoEmbedView` بلا مادة فيديو حقيقية.
    static var storyVideo: String? { value("-elmStoryVideo") }
    /// `-elmDiscover podcasts|jak|keyword:<كلمة>` يدفع وجهة من «استكشف».
    static var discover: String? { value("-elmDiscover") }
    /// `-elmAccount liked|history|settings` يدفع شاشة من «حسابي».
    static var account: String? { value("-elmAccount") }
    static var tab: RootTab? { value("-elmTab").flatMap(RootTab.init(rawValue:)) }
    static var screen: Screen? { value("-elmScreen").flatMap(Screen.init(rawValue:)) }

    /// لوحة التحرير: `-elmStaff open` يفتح المساحة، و`-elmStaffUser u -elmStaffPass p` يدخلان تلقائيًا (تطوير فقط)،
    /// و`-elmStaffSection stories` يختار القسم.
    static var staffOpen: Bool { value("-elmStaff") == "open" || staffUser != nil }
    static var staffUser: String? { value("-elmStaffUser") }
    static var staffPassword: String? { value("-elmStaffPass") }
    static var staffSection: String? { value("-elmStaffSection") }
    static var staffStory: String? { value("-elmStaffStory") }
    /// إجراء آلي على المادة للتحقق بلا نقر: submit | publish | archive | restore | return | edit | upload.
    static var staffAction: String? { value("-elmStaffAction") }
    /// `-elmStaffFresh 1` يمسح كوكي اللوحة عند الإقلاع لتصوير شاشة الدخول.
    static var staffFresh: Bool { value("-elmStaffFresh") == "1" }
    /// `-elmPodcastPlay 1` يشغّل أول حلقة عند فتح شاشة البودكاست — لتصوير المشغّل المصغّر.
    static var podcastPlay: Bool { value("-elmPodcastPlay") == "1" }
}
#endif
