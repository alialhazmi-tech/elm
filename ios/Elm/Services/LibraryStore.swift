import Foundation
import Observation

@MainActor
@Observable
final class LibraryStore {
    private let key = "elm.saved.v1"
    var items: [StoryCard] = []

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let saved = try? JSONDecoder().decode([StoryCard].self, from: data) {
            items = saved
        }
    }

    func contains(_ story: StoryCard) -> Bool {
        items.contains { $0.apiId == story.apiId }
    }

    func toggle(_ story: StoryCard) {
        var next = items
        if let index = next.firstIndex(where: { $0.apiId == story.apiId }) {
            next.remove(at: index)
        } else {
            next.insert(story, at: 0)
        }
        items = next
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
