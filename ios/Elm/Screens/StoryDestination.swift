import SwiftUI
import Observation

/// وجهة فتح أي مادة: تقارير «جاك العلم» تفتح بالقارئ الغامر مباشرة،
/// وما عداها بقارئ المقال. البطاقات لا تعرف الفرق ولا يجب أن تعرفه.
struct StoryDestination: View {
    let seed: StoryCard

    var body: some View {
        if seed.format == JakFormat.slug {
            JakReportScreen(seed: seed)
        } else {
            StoryDetailScreen(seed: seed)
        }
    }
}

enum JakFormat {
    static let slug = "jakalelm"
}

/// حالة الهيكل: القارئ الغامر يخفي شريط التبويب المخصص، ولا سبيل لذلك
/// عبر `.toolbar(.hidden, for: .tabBar)` لأن الشريط رسمُنا لا رسم النظام.
@MainActor
@Observable
final class ChromeState {
    var immersive = false
    var activeReaders: Set<UUID> = []
    var readerVisible: Bool { !activeReaders.isEmpty }
}
