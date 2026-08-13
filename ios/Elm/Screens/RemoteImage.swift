import SwiftUI
#if canImport(UIKit)
import UIKit
import ImageIO
#endif

/// صورة بعيدة بكاش في الذاكرة وإعادة محاولة واحدة.
///
/// `AsyncImage` لا يعيد المحاولة عند فشل الطلب، فكانت صور الهيرو تبقى لوحًا كحليًا
/// فارغًا رغم أن الرابط سليم — والصور هي وجه التطبيق. كما يُصغَّر فك الترميز إلى
/// حجم العرض: مصغّرة 92 نقطة لا تستحق فكّ ترميز ملف بمليون بكسل.
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
        image = nil
        failed = false
        if let cached = ImageStore.shared.image(for: url) {
            image = cached
            return
        }
        // أصل Railway يردّ 502 متقطعًا على `/uploads/*` عند برودة الحاوية،
        // فثلاث محاولات بتباعد متصاعد تكفي لإنقاذ الصورة بدل لوح كحلي فارغ.
        for attempt in 0..<3 {
            if attempt > 0 { try? await Task.sleep(for: .milliseconds(attempt == 1 ? 500 : 1400)) }
            if Task.isCancelled { return }
            if let loaded = await ImageStore.shared.fetch(url, maxPixel: maxPixel) {
                image = loaded
                return
            }
        }
        failed = true
    }
}

/// كاش ذاكرة مشترك + فك ترميز مُصغَّر.
final class ImageStore: @unchecked Sendable {
    static let shared = ImageStore()

    private let cache: NSCache<NSURL, UIImage> = {
        let cache = NSCache<NSURL, UIImage>()
        cache.totalCostLimit = 60 * 1024 * 1024
        return cache
    }()

    func image(for url: URL) -> Image? {
        cache.object(forKey: url as NSURL).map(Image.init(uiImage:))
    }

    func fetch(_ url: URL, maxPixel: CGFloat) async -> Image? {
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 20
            request.setValue("image/*,*/*", forHTTPHeaderField: "Accept")
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 200
            guard (200..<300).contains(status), let decoded = Self.decode(data, maxPixel: maxPixel) else {
                #if DEBUG
                print("ELMIMG status=\(status) bytes=\(data.count) url=\(url.lastPathComponent)")
                #endif
                return nil
            }
            cache.setObject(decoded, forKey: url as NSURL, cost: Int(decoded.size.width * decoded.size.height * 4))
            return Image(uiImage: decoded)
        } catch {
            #if DEBUG
            print("ELMIMG error=\(error) url=\(url.lastPathComponent)")
            #endif
            return nil
        }
    }

    private static func decode(_ data: Data, maxPixel: CGFloat) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else {
            return UIImage(data: data)
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return UIImage(data: data)
        }
        return UIImage(cgImage: cgImage)
    }
}
