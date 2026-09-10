import Foundation
import Observation

/// المحفوظات: للعضو عبر `/api/me/saved` بطابور معلّق؛ وللزائر على الجهاز فقط (ميزة تطبيق، الويب يشترط الدخول).
/// عند أول دخول تُدمج محفوظات الزائر في الحساب (تُرسل `saved:true` لكل واحدة) ثم يُمسح مفتاح الزائر.
@MainActor
@Observable
final class LibraryStore {
    private struct Pending: Codable, Equatable { let saved: Bool; let token: UUID }
    private static let guestKey = "elm.saved.v1"
    private var memberId: String?
    private var generation = UUID()
    private var syncing = false
    private var pending: [String: Pending] = [:]
    private var key: String { memberId.map { "elm.saved.member.\($0)" } ?? Self.guestKey }
    var items: [StoryCard] = []
    var syncError: String?
    /// إشعار لمرة واحدة بعد دمج محفوظات الزائر في الحساب.
    var mergeNotice: String?

    init() { load() }

    func switchAccount(_ id: String?) async {
        if memberId != id {
            let guestItems = id != nil && memberId == nil ? Self.guestItems() : []
            memberId = id
            generation = UUID()
            syncing = false
            syncError = nil
            mergeNotice = nil
            load()
            if let id, !guestItems.isEmpty { merge(guestItems, into: id) }
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

    func dismissMergeNotice() { mergeNotice = nil }

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

    /// محفوظات الزائر تدخل طابور الحساب (`saved:true`) فتُرفع مع أول مزامنة، ويُمسح مفتاح الزائر فورًا
    /// حتى لا تعود بعد الخروج كأنها لم تُنقل.
    private func merge(_ guestItems: [StoryCard], into account: String) {
        for story in guestItems.reversed() where !contains(story) {
            items.insert(story, at: 0)
        }
        for story in guestItems {
            pending[story.apiId] = Pending(saved: true, token: UUID())
        }
        persist()
        UserDefaults.standard.removeObject(forKey: Self.guestKey)
        UserDefaults.standard.removeObject(forKey: Self.guestKey + ".pending")
        mergeNotice = "نُقلت محفوظاتك إلى حسابك"
    }

    private static func guestItems() -> [StoryCard] {
        UserDefaults.standard.data(forKey: guestKey).flatMap { try? JSONDecoder().decode([StoryCard].self, from: $0) } ?? []
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
