import Foundation

@MainActor
enum HomeCache {
    private static let key = "home.v1"

    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "elm-home-v1.json")
    }

    static func save(_ data: Data) {
        AppCache.save(data, key: key)
        // مسار هجرة احتياطي للإصدارات السابقة.
        try? data.write(to: fileURL, options: .atomic)
    }

    static func load() -> Data? {
        if let cached = AppCache.load(key)?.data { return cached }
        guard let legacy = try? Data(contentsOf: fileURL) else { return nil }
        AppCache.save(legacy, key: key)
        return legacy
    }

    static var updatedAt: Date? {
        AppCache.load(key)?.updatedAt
    }
}
