import Foundation

struct SearchPayload: Codable, Sendable {
    var query: String
    var results: [StoryCard]
    var total: Int

    enum CodingKeys: String, CodingKey { case query, results, total }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        query = try c.decodeIfPresent(String.self, forKey: .query) ?? ""
        results = try c.decodeIfPresent([StoryCard].self, forKey: .results) ?? []
        total = try c.decodeIfPresent(Int.self, forKey: .total) ?? results.count
    }
}

struct ForYouItem: Codable, Identifiable, Hashable, Sendable {
    var story: StoryCard
    var reason: String?

    var id: String { story.apiId }

    init(story: StoryCard, reason: String?) {
        self.story = story
        self.reason = reason
    }

    init(from decoder: Decoder) throws {
        story = try StoryCard(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        reason = try c.decodeIfPresent(String.self, forKey: .reason)
    }

    enum CodingKeys: String, CodingKey { case reason }
}

struct ForYouPayload: Codable, Sendable {
    var items: [ForYouItem]

    enum CodingKeys: String, CodingKey { case items }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decodeIfPresent([ForYouItem].self, forKey: .items) ?? []
    }
}
