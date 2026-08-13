import Foundation
import SwiftUI

struct MobileHomePayload: Codable, Sendable {
    var contract: String
    var generatedAt: String
    var breaking: BreakingItem?
    var brief: [BriefItem]
    var hero: StoryCard
    var minis: [StoryCard]
    var mosaic: [StoryCard]
    var dataStory: StoryCard?
    var question: QuestionItem?
    var videos: [StoryCard]
    var numbers: [NumberStat]
    var series: [SeriesChip]
    var mostRead: [StoryCard]

    enum CodingKeys: String, CodingKey {
        case contract, generatedAt, breaking, brief, hero, minis, mosaic
        case dataStory, question, videos, numbers, series, mostRead
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        contract = try c.decodeIfPresent(String.self, forKey: .contract) ?? "home-bundle"
        generatedAt = try c.decodeIfPresent(String.self, forKey: .generatedAt)
            ?? ISO8601DateFormatter().string(from: Date())
        breaking = try c.decodeIfPresent(BreakingItem.self, forKey: .breaking)
        brief = try c.decodeIfPresent([BriefItem].self, forKey: .brief) ?? []
        hero = try c.decode(StoryCard.self, forKey: .hero)
        minis = try c.decodeIfPresent([StoryCard].self, forKey: .minis) ?? []
        mosaic = try c.decodeIfPresent([StoryCard].self, forKey: .mosaic) ?? []
        dataStory = try c.decodeIfPresent(StoryCard.self, forKey: .dataStory)
        question = try c.decodeIfPresent(QuestionItem.self, forKey: .question)
        videos = try c.decodeIfPresent([StoryCard].self, forKey: .videos) ?? []
        numbers = try c.decodeIfPresent([NumberStat].self, forKey: .numbers) ?? []
        series = try c.decodeIfPresent([SeriesChip].self, forKey: .series) ?? []
        mostRead = try c.decodeIfPresent([StoryCard].self, forKey: .mostRead) ?? []
    }
}

struct BreakingItem: Codable, Sendable {
    var title: String
    var href: String
    var until: String
}

struct BriefItem: Codable, Identifiable, Sendable {
    var title: String
    var href: String
    var color: String
    var label: String
    var id: String { href }
}

struct StoryCard: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var slug: String
    var section: String
    var title: String
    var excerpt: String
    var eyebrow: String
    var readingMinutes: Int
    var series: String?
    var format: String?
    var image: String?
    var publishedAt: String?
    var href: String?
    var body: String?
    var factCheck: FactCheck?

    var path: String {
        if let href, !href.isEmpty { return href }
        return "/\(section)/\(id)/\(slug)"
    }

    var imageURL: URL? { ElmMedia.url(image) }

    /// معرّف المادة في `/api/mobile/v1/story/:id` من المسار المقدس.
    var apiId: String {
        let parts = path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        if parts.count >= 2 { return parts[1] }
        return id
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, section, title, excerpt, eyebrow, readingMinutes
        case series, format, image, publishedAt, href, body, factCheck
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        slug = try c.decode(String.self, forKey: .slug)
        section = try c.decode(String.self, forKey: .section)
        title = try c.decode(String.self, forKey: .title)
        excerpt = try c.decodeIfPresent(String.self, forKey: .excerpt) ?? ""
        eyebrow = try c.decodeIfPresent(String.self, forKey: .eyebrow) ?? ""
        readingMinutes = try c.decodeIfPresent(Int.self, forKey: .readingMinutes) ?? 1
        series = try c.decodeIfPresent(String.self, forKey: .series)
        format = try c.decodeIfPresent(String.self, forKey: .format)
        image = try c.decodeIfPresent(String.self, forKey: .image)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        href = try c.decodeIfPresent(String.self, forKey: .href)
        body = try c.decodeIfPresent(String.self, forKey: .body)
        factCheck = try c.decodeIfPresent(FactCheck.self, forKey: .factCheck)
    }

    init(
        id: String,
        slug: String,
        section: String,
        title: String,
        excerpt: String,
        eyebrow: String = "",
        readingMinutes: Int = 1,
        series: String? = nil,
        format: String? = nil,
        image: String? = nil,
        publishedAt: String? = nil,
        href: String? = nil,
        body: String? = nil,
        factCheck: FactCheck? = nil
    ) {
        self.id = id
        self.slug = slug
        self.section = section
        self.title = title
        self.excerpt = excerpt
        self.eyebrow = eyebrow
        self.readingMinutes = readingMinutes
        self.series = series
        self.format = format
        self.image = image
        self.publishedAt = publishedAt
        self.href = href
        self.body = body
        self.factCheck = factCheck
    }
}

struct QuestionItem: Codable, Sendable {
    var kick: String
    var title: String
    var text: String
    var href: String

    var asCard: StoryCard {
        StoryCard(
            id: href,
            slug: href,
            section: "politics",
            title: title,
            excerpt: text,
            eyebrow: kick,
            href: href
        )
    }
}

struct NumberStat: Codable, Identifiable, Sendable {
    var value: String
    var suffix: String?
    var label: String
    var href: String?
    var id: String { "\(value)-\(label)" }
}

struct SeriesChip: Codable, Identifiable, Hashable, Sendable {
    var slug: String
    var name: String
    var description: String
    var color: String
    var id: String { slug }
}

struct FactCheck: Codable, Hashable, Sendable {
    var rumor: String
    var truth: String
}

struct SlideSide: Codable, Hashable, Sendable {
    var label: String
    var value: String
}

struct SlidePoint: Codable, Hashable, Sendable, Identifiable {
    var year: String
    var title: String
    var detail: String
    var id: String { "\(year)-\(title)" }
}

struct StorySlide: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var type: String
    var title: String
    var body: String
    var stat: String?
    var statLabel: String?
    var image: String?
    var eyebrow: String?
    /// جهة العنصر البصري والمساحة الهادئة كما قررهما المحرر في «تحرير العلم».
    var focal: String?
    var textSide: String?
    var sides: [SlideSide]?
    var points: [SlidePoint]?
    var items: [String]?
    var quoteBy: String?

    var imageURL: URL? { ElmMedia.url(image) }

    enum CodingKeys: String, CodingKey {
        case id, type, title, body, stat, statLabel, image
        case eyebrow, focal, textSide, sides, points, items, quoteBy
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? "text"
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        stat = try c.decodeIfPresent(String.self, forKey: .stat)
        statLabel = try c.decodeIfPresent(String.self, forKey: .statLabel)
        image = try c.decodeIfPresent(String.self, forKey: .image)
        eyebrow = try c.decodeIfPresent(String.self, forKey: .eyebrow)
        focal = try c.decodeIfPresent(String.self, forKey: .focal)
        textSide = try c.decodeIfPresent(String.self, forKey: .textSide)
        sides = try c.decodeIfPresent([SlideSide].self, forKey: .sides)
        points = try c.decodeIfPresent([SlidePoint].self, forKey: .points)
        items = try c.decodeIfPresent([String].self, forKey: .items)
        quoteBy = try c.decodeIfPresent(String.self, forKey: .quoteBy)
    }
}

/// الطابع اللوني للتقرير — أربعة ألوان يرسلها الخادم فيتلوّن بها القارئ كله.
struct JakReport: Codable, Hashable, Sendable {
    var palette: String
    var base: String
    var base2: String
    var glow: String
    var glow2: String

    static let economy = JakReport(palette: "economy", base: "0b1a33", base2: "12284b", glow: "f5b92e", glow2: "ffd35e")

    var baseColor: Color { ElmTheme.hex(base) }
    var base2Color: Color { ElmTheme.hex(base2) }
    var glowColor: Color { ElmTheme.hex(glow) }
    var glow2Color: Color { ElmTheme.hex(glow2) }
}

struct StoryDetailPayload: Codable, Sendable {
    var contract: String
    var story: StoryCard
    var series: SeriesChip?
    var related: [StoryCard]
    var nextInSeries: StoryCard?
    var slides: [StorySlide]?
    var jak: JakReport?
    var factCheck: FactCheck?

    enum CodingKeys: String, CodingKey {
        case contract, story, series, related, nextInSeries, slides, jak
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        contract = try c.decodeIfPresent(String.self, forKey: .contract) ?? "mobile-story.v1"
        story = try c.decode(StoryCard.self, forKey: .story)
        series = try c.decodeIfPresent(SeriesChip.self, forKey: .series)
        related = try c.decodeIfPresent([StoryCard].self, forKey: .related) ?? []
        nextInSeries = try c.decodeIfPresent(StoryCard.self, forKey: .nextInSeries)
        slides = try c.decodeIfPresent([StorySlide].self, forKey: .slides)
        jak = try c.decodeIfPresent(JakReport.self, forKey: .jak)
        factCheck = story.factCheck
    }
}

struct SeriesEntry: Codable, Identifiable, Hashable, Sendable {
    var slug: String
    var name: String
    var description: String
    var color: String
    var archived: Bool
    var count: Int
    var latest: StoryCard?
    var id: String { slug }

    var asChip: SeriesChip {
        SeriesChip(slug: slug, name: name, description: description, color: color)
    }

    enum CodingKeys: String, CodingKey {
        case slug, name, description, color, archived, count, latest
    }

    init(slug: String, name: String, description: String, color: String, archived: Bool, count: Int, latest: StoryCard?) {
        self.slug = slug
        self.name = name
        self.description = description
        self.color = color
        self.archived = archived
        self.count = count
        self.latest = latest
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        slug = try c.decode(String.self, forKey: .slug)
        name = try c.decode(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "2B5C9E"
        archived = try c.decodeIfPresent(Bool.self, forKey: .archived) ?? false
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        latest = try c.decodeIfPresent(StoryCard.self, forKey: .latest)
    }
}

struct SeriesIndexPayload: Codable, Sendable {
    var series: [SeriesEntry]
    var archived: [SeriesEntry]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        series = try c.decodeIfPresent([SeriesEntry].self, forKey: .series) ?? []
        archived = try c.decodeIfPresent([SeriesEntry].self, forKey: .archived) ?? []
    }

    enum CodingKeys: String, CodingKey { case series, archived }
}

struct SeriesFeedPayload: Codable, Sendable {
    var series: SeriesEntry
    var stories: [StoryCard]
    var total: Int

    enum CodingKeys: String, CodingKey {
        case series, stories, total
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        stories = try c.decodeIfPresent([StoryCard].self, forKey: .stories) ?? []
        total = try c.decodeIfPresent(Int.self, forKey: .total) ?? stories.count
        if let entry = try? c.decode(SeriesEntry.self, forKey: .series) {
            series = entry
        } else {
            let chip = try c.decode(SeriesChip.self, forKey: .series)
            series = SeriesEntry(
                slug: chip.slug,
                name: chip.name,
                description: chip.description,
                color: chip.color,
                archived: false,
                count: total,
                latest: stories.first
            )
        }
    }
}

