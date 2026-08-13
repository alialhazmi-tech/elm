import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// صورة بعيدة عبر `ImageStore`: كاش ذاكرة/قرص، طلب موحّد، وإعادة محاولة قصيرة عند 502.
struct RemoteImage: View {
    let url: URL?
    var height: CGFloat? = nil
    var minHeight: CGFloat? = nil
    /// أقصى بُعد بالبكسل عند فك الترميز. الافتراضي يكفي عرضًا بعرض الشاشة على 3x.
    var maxPixel: CGFloat = 1400

    @State private var image: Image?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                image.resizable().scaledToFill()
            } else {
                placeholder
                    .overlay {
                        if !failed && url != nil {
                            ProgressView().tint(.white.opacity(0.65))
                        }
                    }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .frame(minHeight: minHeight)
        .clipped()
        .background(ElmTheme.navyDeep)
        // الصورة تزيينية: إبقاؤها خارج اختبار اللمس يجعل البطاقة كلها هدف النقر.
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .task(id: url) { await load() }
    }

    private var placeholder: some View {
        LinearGradient(
            colors: [ElmTheme.navyDeep, ElmTheme.navy],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func load() async {
        guard let url else { return }
        if let cached = ImageStore.shared.image(for: url, maxPixel: maxPixel) {
            image = cached
            failed = false
            return
        }
        failed = false
        if let loaded = await ImageStore.shared.load(url, maxPixel: maxPixel) {
            image = loaded
        } else if image == nil {
            failed = true
        }
    }
}

/// صورة ملء الشاشة بحجم آمن: `RemoteImage` وحدها تُرجع مقاسًا أكبر من المقترح
/// عند `scaledToFill`، فتضخّم الحاوية كلها. `Color.clear` يثبّت الحجم والصورة طبقة فوقه.
struct FullBleedImage: View {
    let url: URL?
    var maxPixel: CGFloat = 2400

    var body: some View {
        Color.clear
            .overlay { RemoteImage(url: url, maxPixel: maxPixel) }
            .clipped()
    }
}
