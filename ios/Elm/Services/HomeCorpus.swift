import Foundation

@MainActor
enum HomeCorpus {
    static func cards() -> [StoryCard] {
        cards(from: HomeCache.load())
    }

    static func cards(from data: Data?) -> [StoryCard] {
        guard let data, let home = try? JSONDecoder().decode(MobileHomePayload.self, from: data) else {
            return []
        }
        var seen = Set<String>()
        var out: [StoryCard] = []
        var pool = (home.hasHero ? [home.hero] : []) + home.minis + home.mosaic + [home.dataStory].compactMap { $0 } + home.videos + home.mostRead
        pool += home.presentation?.stream?.river ?? []
        pool += (home.presentation?.stream?.panels ?? []).flatMap { ($0.lead.map { [$0] } ?? []) + $0.rows }
        for card in pool {
            if seen.insert(card.apiId).inserted {
                out.append(card)
            }
        }
        return out
    }

    static func search(_ query: String) -> [StoryCard] {
        let needle = ArabicNormalize.fold(query)
        guard !needle.isEmpty else { return [] }
        return cards().filter { card in
            ArabicNormalize.fold("\(card.title) \(card.excerpt) \(card.eyebrow)").contains(needle)
        }
    }
}
