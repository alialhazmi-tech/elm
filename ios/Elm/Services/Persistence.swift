import Foundation
import SwiftData

@Model
final class CachedPayload {
    @Attribute(.unique) var key: String
    var data: Data
    var updatedAt: Date

    init(key: String, data: Data, updatedAt: Date = .now) {
        self.key = key
        self.data = data
        self.updatedAt = updatedAt
    }
}

/// مخزن SwiftData موحّد لحزمة الرئيسية وتفاصيل المواد.
/// يبقى ملف M0 القديم مسار هجرة فقط حتى لا نفقد كاش مستخدم حالي.
@MainActor
enum AppCache {
    private static let container: ModelContainer? = {
        let schema = Schema([CachedPayload.self])
        let configuration = ModelConfiguration("ElmOfflineCache", schema: schema)
        return try? ModelContainer(for: schema, configurations: [configuration])
    }()

    static func save(_ data: Data, key: String) {
        guard let container else { return }
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedPayload>(predicate: #Predicate { $0.key == key })
        if let existing = try? context.fetch(descriptor).first {
            existing.data = data
            existing.updatedAt = .now
        } else {
            context.insert(CachedPayload(key: key, data: data))
        }
        try? context.save()
    }

    static func load(_ key: String) -> (data: Data, updatedAt: Date)? {
        guard let container else { return nil }
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedPayload>(predicate: #Predicate { $0.key == key })
        guard let item = try? context.fetch(descriptor).first else { return nil }
        return (item.data, item.updatedAt)
    }

    static func saveStory(_ detail: StoryDetailPayload) {
        guard let data = try? JSONEncoder().encode(detail) else { return }
        save(data, key: "story.\(detail.story.apiId)")
    }

    static func loadStory(id: String) -> StoryDetailPayload? {
        guard let cached = load("story.\(id)") else { return nil }
        return try? JSONDecoder().decode(StoryDetailPayload.self, from: cached.data)
    }
}
