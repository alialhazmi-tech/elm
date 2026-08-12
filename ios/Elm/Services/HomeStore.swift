import Foundation
import Observation

@MainActor
@Observable
final class HomeStore {
    var payload: MobileHomePayload?
    var fromCache = false
    var loading = false
    var errorMessage: String?

    func load() async {
        if payload == nil, let cached = HomeCache.load() {
            payload = try? JSONDecoder().decode(MobileHomePayload.self, from: cached)
            fromCache = payload != nil
        }
        await refresh()
    }

    func refresh() async {
        loading = payload == nil
        errorMessage = nil
        do {
            let (fresh, data) = try await APIClient.fetchHome()
            payload = fresh
            fromCache = false
            HomeCache.save(data)
        } catch {
            if payload == nil {
                errorMessage = "تعذر تحميل الرئيسية. تحقق من الاتصال ثم أعد المحاولة."
            } else {
                fromCache = true
            }
        }
        loading = false
    }
}
