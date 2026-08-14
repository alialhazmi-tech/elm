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
            if let payload {
                ImageStore.shared.prefetch(payload.prefetchURLs)
                prefetchJakReports(in: payload)
            }
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
            ImageStore.shared.prefetch(fresh.prefetchURLs)
            prefetchJakReports(in: fresh)
        } catch {
            if payload == nil {
                errorMessage = "تعذر تحميل الرئيسية. تحقق من الاتصال ثم أعد المحاولة."
            } else {
                fromCache = true
            }
        }
        loading = false
    }

    /// استحضار مسبق في الخلفية لتقارير جاك العلم المعروضة في الرئيسية لفتحها فورًا
    private func prefetchJakReports(in payload: MobileHomePayload) {
        var cards = [payload.hero] + payload.minis + payload.mosaic + payload.mostRead + payload.videos
        if let dataStory = payload.dataStory { cards.append(dataStory) }
        let jakCards = cards.filter { $0.format == JakFormat.slug }
        guard !jakCards.isEmpty else { return }
        Task.detached(priority: .utility) {
            for card in jakCards.prefix(4) {
                if let detail = try? await APIClient.fetchStory(id: card.apiId) {
                    await AppCache.saveStory(detail)
                    var urls = [detail.story.imageURL].compactMap { $0 }
                    if let slides = detail.slides {
                        urls.append(contentsOf: slides.compactMap(\.imageURL))
                    }
                    ImageStore.shared.prefetch(urls, maxPixel: 1400)
                }
            }
        }
    }
}
