import Foundation
import Observation

@MainActor
@Observable
final class LibraryStore {
    private struct Pending: Codable, Equatable { let saved: Bool; let token: UUID }
    private var memberId: String?
    private var generation = UUID()
    private var syncing = false
    private var pending: [String: Pending] = [:]
    private var key: String { memberId.map { "elm.saved.member.\($0)" } ?? "elm.saved.v1" }
    var items: [StoryCard] = []
    var syncError: String?

    init() { load() }

    func switchAccount(_ id: String?) async {
        if memberId != id {
            memberId = id
            generation = UUID()
            syncing = false
            syncError = nil
            load()
        }
        await synchronize()
    }

    func contains(_ story: StoryCard) -> Bool { items.contains { $0.apiId == story.apiId } }

    func toggle(_ story: StoryCard) {
        let saved = !contains(story)
        items.removeAll { $0.apiId == story.apiId }
        if saved { items.insert(story, at: 0) }
        if memberId != nil { pending[story.apiId] = Pending(saved: saved, token: UUID()) }
        persist()
        Task { await synchronize() }
    }

    func synchronize() async {
        guard let account = memberId, !syncing else { return }
        let epoch = generation
        syncing = true
        defer { if epoch == generation { syncing = false } }
        do {
            repeat {
                for (id, operation) in pending {
                    guard epoch == generation else { return }
                    try await APIClient.setSaved(storyId: id, saved: operation.saved, memberId: account)
                    guard epoch == generation else { return }
                    if pending[id] == operation { pending.removeValue(forKey: id) }
                    persist()
                }
                var remote: [StoryCard] = []
                var offset = 0
                while true {
                    let page = try await APIClient.fetchSaved(offset: offset)
                    guard epoch == generation, page.memberId == account else { return }
                    remote.append(contentsOf: page.items)
                    guard let next = page.nextOffset else { break }
                    offset = next
                }
                // أي نقرة أثناء القراءة تبقى في الطابور وتُطبّق قبل عرض النسخة النهائية.
                if pending.isEmpty {
                    var seen = Set<String>()
                    items = remote.filter { seen.insert($0.apiId).inserted }
                    persist()
                }
            } while !pending.isEmpty
            syncError = nil
        } catch {
            if epoch == generation { syncError = "المحفوظات متاحة على الجهاز. تعذرت المزامنة؛ اسحب للتحديث والمحاولة." }
        }
    }

    private func load() {
        items = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode([StoryCard].self, from: $0) } ?? []
        pending = UserDefaults.standard.data(forKey: key + ".pending").flatMap { try? JSONDecoder().decode([String: Pending].self, from: $0) } ?? [:]
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) { UserDefaults.standard.set(data, forKey: key) }
        if let data = try? JSONEncoder().encode(pending) { UserDefaults.standard.set(data, forKey: key + ".pending") }
    }
}
