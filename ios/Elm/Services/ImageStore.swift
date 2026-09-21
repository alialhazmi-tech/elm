import CryptoKit
import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
import ImageIO
#endif

/// كاش ذاكرة + قرص + تنزيل موحّد لكل رابط.
/// أصل `/uploads` يمر Railway→S3 (~1 ث/ملف)، فبدون قرص كانت كل بطاقة تعيد التنزيل،
/// والمصغّرة تجرّ الملف الكامل ثم تفكّه.
final class ImageStore: @unchecked Sendable {
    static let shared = ImageStore()

    #if canImport(UIKit)
    private let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 80 * 1024 * 1024
        cache.countLimit = 180
        return cache
    }()
    #endif

    private let lock = NSLock()
    private var inflight: [URL: Task<Data?, Never>] = [:]
    private let session: URLSession
    private let diskDir: URL
    private let maxAge: TimeInterval = 60 * 60 * 24 * 14

    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        diskDir = caches.appendingPathComponent("ElmImages", isDirectory: true)
        try? FileManager.default.createDirectory(at: diskDir, withIntermediateDirectories: true)

        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(
            memoryCapacity: 40 * 1024 * 1024,
            diskCapacity: 280 * 1024 * 1024,
            directory: caches.appendingPathComponent("ElmURLCache", isDirectory: true)
        )
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 18
        config.waitsForConnectivity = false
        config.httpMaximumConnectionsPerHost = 8
        config.httpAdditionalHeaders = ["Accept": "image/webp,image/avif,image/jpeg,image/*,*/*;q=0.8"]
        session = URLSession(configuration: config)
    }

    func image(for url: URL, maxPixel: CGFloat = 1080) -> Image? {
        #if canImport(UIKit)
        if let ui = memory.object(forKey: memKey(url, maxPixel: maxPixel)) {
            return Image(uiImage: ui)
        }
        if let data = diskData(url), let ui = Self.decode(data, maxPixel: maxPixel) {
            remember(ui, for: url, maxPixel: maxPixel)
            return Image(uiImage: ui)
        }
        #endif
        return nil
    }

    func prefetch(_ urls: [URL], maxPixel: CGFloat = 1080) {
        let unique = Self.dedupe(urls)
        guard !unique.isEmpty else { return }
        Task.detached(priority: .utility) { [unique] in
            await withTaskGroup(of: Void.self) { group in
                for url in unique.prefix(16) {
                    group.addTask { _ = await self.load(url, maxPixel: maxPixel) }
                }
            }
        }
    }

    func load(_ url: URL, maxPixel: CGFloat) async -> Image? {
        #if canImport(UIKit)
        if let ui = memory.object(forKey: memKey(url, maxPixel: maxPixel)) {
            return Image(uiImage: ui)
        }
        let data: Data?
        if let disk = diskData(url) {
            data = disk
        } else {
            data = await download(url)
        }
        guard let data, let ui = Self.decode(data, maxPixel: maxPixel) else { return nil }
        remember(ui, for: url, maxPixel: maxPixel)
        return Image(uiImage: ui)
        #else
        return nil
        #endif
    }

    #if canImport(UIKit)
    /// صورة UIKit للغلاف في مركز «يُشغَّل الآن».
    func uiImage(_ url: URL, maxPixel: CGFloat = 600) async -> UIImage? {
        if let ui = memory.object(forKey: memKey(url, maxPixel: maxPixel)) { return ui }
        var data = diskData(url)
        if data == nil { data = await download(url) }
        guard let data, let ui = Self.decode(data, maxPixel: maxPixel) else { return nil }
        remember(ui, for: url, maxPixel: maxPixel)
        return ui
    }
    #endif

    private func download(_ url: URL) async -> Data? {
        let task: Task<Data?, Never> = lock.withLock {
            if let existing = inflight[url] { return existing }
            let created = Task { await fetchBytes(url) }
            inflight[url] = created
            return created
        }
        let data = await task.value
        lock.withLock { inflight[url] = nil }
        return data
    }

    private func fetchBytes(_ url: URL) async -> Data? {
        if let cached = diskData(url) { return cached }
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        for attempt in 0..<2 {
            if attempt > 0 { try? await Task.sleep(for: .milliseconds(280)) }
            if Task.isCancelled { return nil }
            do {
                let (data, response) = try await session.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 200
                if (200..<300).contains(status), data.count > 32 {
                    writeDisk(data, for: url)
                    return data
                }
                if ![502, 503, 429].contains(status) { return nil }
            } catch {
                #if DEBUG
                print("ELMIMG error=\(error) url=\(url.lastPathComponent)")
                #endif
            }
        }
        return nil
    }

    #if canImport(UIKit)
    private func remember(_ image: UIImage, for url: URL, maxPixel: CGFloat) {
        let cost = Int(image.size.width * image.size.height * 4)
        memory.setObject(image, forKey: memKey(url, maxPixel: maxPixel), cost: cost)
    }

    private func memKey(_ url: URL, maxPixel: CGFloat) -> NSString {
        "\(url.absoluteString)#\(Int(maxPixel))" as NSString
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
    #endif

    private func diskData(_ url: URL) -> Data? {
        let file = diskFile(for: url)
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: file.path),
              let modified = attrs[.modificationDate] as? Date,
              Date().timeIntervalSince(modified) < maxAge
        else { return nil }
        return try? Data(contentsOf: file)
    }

    private func writeDisk(_ data: Data, for url: URL) {
        try? data.write(to: diskFile(for: url), options: .atomic)
    }

    private func diskFile(for url: URL) -> URL {
        let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
        let name = digest.map { String(format: "%02x", $0) }.joined()
        return diskDir.appendingPathComponent(name)
    }

    private static func dedupe(_ urls: [URL]) -> [URL] {
        var seen = Set<URL>()
        return urls.filter { seen.insert($0).inserted }
    }
}
