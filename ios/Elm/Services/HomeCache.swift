import Foundation

enum HomeCache {
    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "elm-home-v1.json")
    }

    static func save(_ data: Data) {
        try? data.write(to: fileURL, options: .atomic)
    }

    static func load() -> Data? {
        try? Data(contentsOf: fileURL)
    }
}
