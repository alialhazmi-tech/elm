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
    var presentation: HomePresentation?
    /// الويب يعرض «لا مواد منشورة بعد» حين لا صدارة؛ هنا تبقى `hero` غير اختيارية للمستهلكين
    /// القدامى، ويحمل هذا العلم غيابها الفعلي.
    var hasHero = true

    enum CodingKeys: String, CodingKey {
        case contract, generatedAt, breaking, brief, hero, minis, mosaic
        case dataStory, question, videos, numbers, series, mostRead, presentation
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        contract = try c.decodeIfPresent(String.self, forKey: .contract) ?? "home-bundle"
        generatedAt = try c.decodeIfPresent(String.self, forKey: .generatedAt)
            ?? ISO8601DateFormatter().string(from: Date())
        breaking = try c.decodeIfPresent(BreakingItem.self, forKey: .breaking)
        brief = try c.decodeIfPresent([BriefItem].self, forKey: .brief) ?? []
        if let lead = try c.decodeIfPresent(StoryCard.self, forKey: .hero) {
            hero = lead
        } else {
            hero = StoryCard.placeholder
            hasHero = false
        }
        minis = try c.decodeIfPresent([StoryCard].self, forKey: .minis) ?? []
        mosaic = try c.decodeIfPresent([StoryCard].self, forKey: .mosaic) ?? []
        dataStory = try c.decodeIfPresent(StoryCard.self, forKey: .dataStory)
        question = try c.decodeIfPresent(QuestionItem.self, forKey: .question)
        videos = try c.decodeIfPresent([StoryCard].self, forKey: .videos) ?? []
        numbers = try c.decodeIfPresent([NumberStat].self, forKey: .numbers) ?? []
        series = try c.decodeIfPresent([SeriesChip].self, forKey: .series) ?? []
        mostRead = try c.decodeIfPresent([StoryCard].self, forKey: .mostRead) ?? []
        // العرض إضافي فوق العقد v1 — عطبه لا يُسقط الحزمة كلها.
        presentation = (try? c.decodeIfPresent(HomePresentation.self, forKey: .presentation)) ?? nil
    }

    var prefetchURLs: [URL] {
        var cards: [StoryCard] = (hasHero ? [hero] : []) + minis + mosaic + videos + mostRead
        if let dataStory { cards.append(dataStory) }
        cards += presentation?.stream?.river ?? []
        cards += (presentation?.stream?.panels ?? []).flatMap { ($0.lead.map { [$0] } ?? []) + $0.rows }
        return cards.compactMap(\.imageURL)
    }

    /// عناصر الشريط الإخباري كما يعرضها الويب: قائمة التناوب إن وصلت، وإلا العاجل المفرد.
    var stripItems: [NewsStripItem] {
        if let items = presentation?.newsStrip, !items.isEmpty { return items }
        guard let breaking else { return [] }
        return [NewsStripItem(title: breaking.title, href: breaking.href, urgent: breaking.urgent, label: breaking.label, until: breaking.until)]
    }
}

struct BreakingItem: Codable, Sendable {
    var title: String
    var href: String
    var until: String
    /// «عاجل» الأحمر للساعة الأولى من مادة مُعلَّمة فقط؛ وإلا «الأحدث».
    var urgent: Bool
    /// اسم السلسلة أو التصنيف.
    var label: String?

    enum CodingKeys: String, CodingKey { case title, href, until, urgent, label }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        href = try c.decodeIfPresent(String.self, forKey: .href) ?? ""
        until = try c.decodeIfPresent(String.self, forKey: .until) ?? ""
        urgent = try c.decodeIfPresent(Bool.self, forKey: .urgent) ?? false
        label = try c.decodeIfPresent(String.self, forKey: .label)
    }
}

struct BriefItem: Codable, Identifiable, Sendable {
    var publishedAt: String?
    var excerpt: String?
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
    // mobile-story.v3 — كلها اختيارية حتى تظل الكاشات والخوادم الأقدم تُفكّ.
    var bodyHtml: String?
    var blocks: [ArticleBlock]?
    var videoUrl: String?
    var videoEmbedUrl: String?
    var videoKind: String?
    var keywords: [StoryKeyword]?
    var links: [StoryLink]?
    var updatedAt: String?
    /// رابط المشاركة المُصدَّر `/share/{id}/{ver}` كما يرسله الخادم (v3) — يتجاوز معاينات ما قبل النقل.
    var shareUrl: String?

    /// رابط المشاركة: المُصدَّر من الخادم إن وصل، وإلا الرابط المقدس.
    var shareURL: URL {
        shareUrl.flatMap(URL.init(string:)) ?? URLConstants.publicURL(path: path)
    }

    /// مادة إنفوجرافيك: الصورة هي المادة، تُعرض كاملة لا مقصوصة.
    var isInfographic: Bool {
        section == "infographics" || format == "infographics" || format == "infographic"
    }
    var isPodcast: Bool { format == "podcasts" }
    /// نُشرت خلال الساعة الأخيرة — النقطة الخضراء في «الجديد الآن».
    var isFresh: Bool {
        guard let date = ElmDates.parse(publishedAt) else { return false }
        return Date().timeIntervalSince(date) < 3600
    }

    /// بطاقة فارغة لحزمة بلا صدارة (`hasHero == false`).
    static let placeholder = StoryCard(id: "", slug: "", section: "news", title: "", excerpt: "")

    /// بلوكات المتن: من الخادم أولًا، ثم من HTML المنقّى، ثم من النص الخالص.
    var articleBlocks: [ArticleBlock] {
        if let blocks, !blocks.isEmpty { return blocks }
        if let bodyHtml, !bodyHtml.isEmpty { return ArticleBlocks.parse(html: bodyHtml) }
        return ArticleBlocks.parse(html: body ?? "")
    }

    var videoURL: URL? { videoUrl.flatMap(URL.init(string:)) }
    var videoEmbedURL: URL? { videoEmbedUrl.flatMap(URL.init(string:)) }

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
        case bodyHtml, blocks, videoUrl, videoEmbedUrl, videoKind, keywords, links, updatedAt, shareUrl
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
        bodyHtml = try c.decodeIfPresent(String.self, forKey: .bodyHtml)
        blocks = try? c.decodeIfPresent([ArticleBlock].self, forKey: .blocks)
        videoUrl = try c.decodeIfPresent(String.self, forKey: .videoUrl)
        videoEmbedUrl = try c.decodeIfPresent(String.self, forKey: .videoEmbedUrl)
        videoKind = try c.decodeIfPresent(String.self, forKey: .videoKind)
        keywords = try? c.decodeIfPresent([StoryKeyword].self, forKey: .keywords)
        links = try? c.decodeIfPresent([StoryLink].self, forKey: .links)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        shareUrl = try c.decodeIfPresent(String.self, forKey: .shareUrl)
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
        factCheck: FactCheck? = nil,
        videoUrl: String? = nil,
        videoEmbedUrl: String? = nil,
        videoKind: String? = nil,
        shareUrl: String? = nil
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
        self.videoUrl = videoUrl
        self.videoEmbedUrl = videoEmbedUrl
        self.videoKind = videoKind
        self.shareUrl = shareUrl
    }

    /// يُكمل حقول الفيديو من بطاقة البذرة إن خلت نسخة الخادم/الكاش منها (خادم أقدم من v3).
    func inheritingVideo(from seed: StoryCard) -> StoryCard {
        guard videoEmbedUrl == nil, videoUrl == nil, seed.videoEmbedUrl != nil || seed.videoUrl != nil else { return self }
        var copy = self
        copy.videoUrl = seed.videoUrl
        copy.videoEmbedUrl = seed.videoEmbedUrl
        copy.videoKind = seed.videoKind
        return copy
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

/// كلمة مفتاحية للمادة — `href` هو `/keywords/{encoded}`.
struct StoryKeyword: Codable, Hashable, Identifiable, Sendable {
    var keyword: String
    var href: String
    var id: String { keyword }
}

/// رابط خارجي ورد في المتن.
struct StoryLink: Codable, Hashable, Identifiable, Sendable {
    var href: String
    var label: String
    var id: String { href }
    var url: URL? { URL(string: href) }
}

// MARK: - البودكاست

struct PodcastShow: Codable, Hashable, Identifiable, Sendable {
    var storyId: String
    var name: String
    var cover: String?
    var accent: String?
    var youtube: String?
    var href: String?
    var id: String { storyId }
    var coverURL: URL? { ElmMedia.url(cover) }
    var accentColor: Color { accent.map { ElmTheme.hex($0) } ?? ElmTheme.navyInk }
}

struct PodcastEpisode: Codable, Hashable, Identifiable, Sendable {
    var title: String
    var audioUrl: String
    var mime: String?
    var publishedAt: String?
    var duration: String?
    var description: String?
    var episode: String?
    var season: String?
    var id: String { audioUrl }
    var audioURL: URL? { URL(string: audioUrl) }

    enum CodingKeys: String, CodingKey { case title, audioUrl, mime, publishedAt, duration, description, episode, season }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        audioUrl = try c.decodeIfPresent(String.self, forKey: .audioUrl) ?? ""
        mime = try c.decodeIfPresent(String.self, forKey: .mime)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        duration = try c.decodeIfPresent(String.self, forKey: .duration)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        episode = try c.decodeIfPresent(String.self, forKey: .episode)
        season = try c.decodeIfPresent(String.self, forKey: .season)
    }
}

/// `podcast` داخل حمولة المادة.
struct PodcastBundle: Codable, Hashable, Sendable {
    var show: PodcastShow
    var episodes: [PodcastEpisode]

    enum CodingKeys: String, CodingKey { case show, episodes }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        show = try c.decode(PodcastShow.self, forKey: .show)
        episodes = (try? c.decodeIfPresent([PodcastEpisode].self, forKey: .episodes)) ?? []
    }
}

/// `GET /api/mobile/v1/podcasts` — برنامج مع حلقاته.
struct PodcastShowEntry: Codable, Hashable, Identifiable, Sendable {
    var show: PodcastShow
    var episodes: [PodcastEpisode]
    var id: String { show.storyId }

    init(from decoder: Decoder) throws {
        show = try PodcastShow(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        episodes = (try? c.decodeIfPresent([PodcastEpisode].self, forKey: .episodes)) ?? []
    }

    func encode(to encoder: Encoder) throws {
        try show.encode(to: encoder)
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(episodes, forKey: .episodes)
    }

    enum CodingKeys: String, CodingKey { case episodes }
}

struct PodcastsPayload: Codable, Sendable {
    var shows: [PodcastShowEntry]
    enum CodingKeys: String, CodingKey { case shows }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        shows = try c.decodeIfPresent([PodcastShowEntry].self, forKey: .shows) ?? []
    }
}

// MARK: - التصنيف والكلمات وجاك

struct TaxonomySection: Codable, Hashable, Identifiable, Sendable {
    var slug: String
    var name: String
    var shortName: String
    var color: String?
    var id: String { slug }

    enum CodingKeys: String, CodingKey { case slug, name, shortName, color }
    init(slug: String, name: String, shortName: String, color: String?) {
        self.slug = slug; self.name = name; self.shortName = shortName; self.color = color
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        slug = try c.decode(String.self, forKey: .slug)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? slug
        shortName = try c.decodeIfPresent(String.self, forKey: .shortName) ?? name
        color = try c.decodeIfPresent(String.self, forKey: .color)
    }
}

struct TaxonomyPayload: Codable, Sendable {
    var sections: [TaxonomySection]
    var series: [SeriesChip]
    var archivedSeries: [SeriesChip]

    enum CodingKeys: String, CodingKey { case sections, series, archivedSeries }
    init(sections: [TaxonomySection], series: [SeriesChip], archivedSeries: [SeriesChip]) {
        self.sections = sections; self.series = series; self.archivedSeries = archivedSeries
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sections = try c.decodeIfPresent([TaxonomySection].self, forKey: .sections) ?? []
        series = try c.decodeIfPresent([SeriesChip].self, forKey: .series) ?? []
        archivedSeries = try c.decodeIfPresent([SeriesChip].self, forKey: .archivedSeries) ?? []
    }
}

struct KeywordPage: Codable, Sendable {
    var keyword: String
    var stories: [StoryCard]
    var total: Int
    var page: Int
    var nextPage: Int?

    enum CodingKeys: String, CodingKey { case keyword, stories, total, page, nextPage }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        keyword = try c.decodeIfPresent(String.self, forKey: .keyword) ?? ""
        stories = try c.decodeIfPresent([StoryCard].self, forKey: .stories) ?? []
        total = try c.decodeIfPresent(Int.self, forKey: .total) ?? stories.count
        page = try c.decodeIfPresent(Int.self, forKey: .page) ?? 1
        nextPage = try c.decodeIfPresent(Int.self, forKey: .nextPage)
    }
}

struct JakPayload: Codable, Sendable {
    var stories: [StoryCard]
    enum CodingKeys: String, CodingKey { case stories }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        stories = try c.decodeIfPresent([StoryCard].self, forKey: .stories) ?? []
    }
}

// MARK: - حساب العضو (`mobile-account.v1`)

struct AccountUser: Codable, Sendable {
    var name: String
    var email: String
    var joinedAt: String?
    var emailVerified: Bool
    var image: String?

    enum CodingKeys: String, CodingKey { case name, email, joinedAt, emailVerified, image }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        email = try c.decodeIfPresent(String.self, forKey: .email) ?? ""
        joinedAt = try c.decodeIfPresent(String.self, forKey: .joinedAt)
        emailVerified = try c.decodeIfPresent(Bool.self, forKey: .emailVerified) ?? false
        image = try c.decodeIfPresent(String.self, forKey: .image)
    }
}

struct AccountStats: Codable, Sendable {
    var articlesRead: Int
    var activeMinutes: Int
    var savedCount: Int
    var likedCount: Int
    var aiInteractions: Int

    enum CodingKeys: String, CodingKey { case articlesRead, activeMinutes, savedCount, likedCount, aiInteractions }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        articlesRead = try c.decodeIfPresent(Int.self, forKey: .articlesRead) ?? 0
        activeMinutes = try c.decodeIfPresent(Int.self, forKey: .activeMinutes) ?? 0
        savedCount = try c.decodeIfPresent(Int.self, forKey: .savedCount) ?? 0
        likedCount = try c.decodeIfPresent(Int.self, forKey: .likedCount) ?? 0
        aiInteractions = try c.decodeIfPresent(Int.self, forKey: .aiInteractions) ?? 0
    }
}

/// عنصر القائمة: محفوظ/معجب `{story, savedAt}` أو سجل `{story, progress, lastVisitAt}`.
struct AccountItem: Codable, Identifiable, Sendable {
    var story: StoryCard
    var savedAt: String?
    var progress: Int?
    var lastVisitAt: String?
    var id: String { story.apiId }

    enum CodingKeys: String, CodingKey { case story, savedAt, progress, lastVisitAt }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        story = try c.decode(StoryCard.self, forKey: .story)
        savedAt = try c.decodeIfPresent(String.self, forKey: .savedAt)
        progress = try c.decodeIfPresent(Int.self, forKey: .progress)
        lastVisitAt = try c.decodeIfPresent(String.self, forKey: .lastVisitAt)
    }
}

struct AccountPayload: Codable, Sendable {
    var memberId: String
    var tab: String
    var user: AccountUser?
    var stats: AccountStats?
    var newsletterSubscribed: Bool
    var personalizationEnabled: Bool
    var items: [AccountItem]
    var page: Int
    var pageCount: Int

    enum CodingKeys: String, CodingKey {
        case memberId, tab, user, stats, newsletterSubscribed, personalizationEnabled, items, page, pageCount
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        memberId = try c.decodeIfPresent(String.self, forKey: .memberId) ?? ""
        tab = try c.decodeIfPresent(String.self, forKey: .tab) ?? "overview"
        user = try? c.decodeIfPresent(AccountUser.self, forKey: .user)
        stats = try? c.decodeIfPresent(AccountStats.self, forKey: .stats)
        newsletterSubscribed = try c.decodeIfPresent(Bool.self, forKey: .newsletterSubscribed) ?? false
        personalizationEnabled = try c.decodeIfPresent(Bool.self, forKey: .personalizationEnabled) ?? true
        items = (try? c.decodeIfPresent([AccountItem].self, forKey: .items)) ?? []
        page = try c.decodeIfPresent(Int.self, forKey: .page) ?? 1
        pageCount = try c.decodeIfPresent(Int.self, forKey: .pageCount) ?? 1
    }
}

/// `GET /api/viewer` — هل بريد العضو موثّق؟
struct ViewerPayload: Codable, Sendable {
    struct Member: Codable, Sendable {
        var name: String?
        var image: String?
        var emailVerified: Bool?
    }
    var member: Member?
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
    var podcast: PodcastBundle?

    enum CodingKeys: String, CodingKey {
        case contract, story, series, related, nextInSeries, slides, jak, podcast
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
        podcast = try? c.decodeIfPresent(PodcastBundle.self, forKey: .podcast)
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


struct HomePresentation: Codable, Sendable {
    var briefFrom: Int
    var briefScript: String
    var newsStrip: [NewsStripItem]
    var stream: HomeWebStream?
    var seriesDirectory: [SeriesEntry]
    var archive: [StoryCard]
}
struct NewsStripItem: Codable, Identifiable, Sendable {
    var title: String
    var href: String
    var urgent: Bool
    var label: String?
    /// نهاية نافذة «عاجل» لمادة مُعلَّمة؛ لغيرها يساوي تاريخ النشر (ليس انتهاءً).
    var until: String?
    var id: String { href }

    /// «عاجل» فقط ما دامت النافذة سارية — الكاش القديم لا يُبقي الأحمر بعد انقضائها.
    var isUrgentNow: Bool {
        guard urgent else { return false }
        guard let end = ElmDates.parse(until) else { return true }
        return end > Date()
    }
    /// مادة مُعلَّمة انقضت نافذتها — تُسقط عند العرض من الكاش.
    var isExpired: Bool {
        guard urgent, let end = ElmDates.parse(until) else { return false }
        return end <= Date()
    }

    init(title: String, href: String, urgent: Bool, label: String? = nil, until: String? = nil) {
        self.title = title; self.href = href; self.urgent = urgent; self.label = label; self.until = until
    }

    enum CodingKeys: String, CodingKey { case title, href, urgent, label, until }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        href = try c.decodeIfPresent(String.self, forKey: .href) ?? ""
        urgent = try c.decodeIfPresent(Bool.self, forKey: .urgent) ?? false
        label = try c.decodeIfPresent(String.self, forKey: .label)
        until = try c.decodeIfPresent(String.self, forKey: .until)
    }
}

/// `GET /api/content/news-strip` — `{items}`.
struct NewsStripPayload: Codable, Sendable {
    var items: [NewsStripItem]
    enum CodingKeys: String, CodingKey { case items }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decodeIfPresent([NewsStripItem].self, forKey: .items) ?? []
    }
}

/// `GET /api/mobile/v1/search?q=&page=` — 18 نتيجة للصفحة كما في `/search` على الويب.
struct SearchPage: Codable, Sendable {
    var query: String
    var results: [StoryCard]
    var total: Int
    var page: Int
    var pageCount: Int
    var nextPage: Int?

    enum CodingKeys: String, CodingKey { case query, results, total, page, pageCount, nextPage }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        query = try c.decodeIfPresent(String.self, forKey: .query) ?? ""
        results = try c.decodeIfPresent([StoryCard].self, forKey: .results) ?? []
        total = try c.decodeIfPresent(Int.self, forKey: .total) ?? results.count
        page = try c.decodeIfPresent(Int.self, forKey: .page) ?? 1
        pageCount = try c.decodeIfPresent(Int.self, forKey: .pageCount) ?? 1
        nextPage = try c.decodeIfPresent(Int.self, forKey: .nextPage)
    }
}

/// `GET /api/content/insights?storyId=` — مؤشرات مجمّعة بلا بيانات فردية.
struct StoryInsights: Codable, Sendable {
    var readers: Int
    var avgMinutes: Double
    var completion: Int
    var likes: Int
    var answers: Int
    var trend: Int

    /// الويب لا يعرض النسب قبل 20 قارئًا.
    var sampleReady: Bool { readers >= 20 }

    enum CodingKeys: String, CodingKey { case readers, avgMinutes, completion, likes, answers, trend }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        readers = try c.decodeIfPresent(Int.self, forKey: .readers) ?? 0
        avgMinutes = try c.decodeIfPresent(Double.self, forKey: .avgMinutes) ?? 0
        completion = Int((try? c.decodeIfPresent(Double.self, forKey: .completion)) ?? 0)
        likes = try c.decodeIfPresent(Int.self, forKey: .likes) ?? 0
        answers = try c.decodeIfPresent(Int.self, forKey: .answers) ?? 0
        trend = try c.decodeIfPresent(Int.self, forKey: .trend) ?? 0
    }
}

/// عنصر «نرشّح لك» من `/api/me/related` — مع سبب الترشيح للعضو.
struct RelatedItem: Codable, Identifiable, Hashable, Sendable {
    struct Reason: Codable, Hashable, Sendable {
        var code: String
        var text: String
    }
    var id: String
    var href: String
    var title: String
    var excerpt: String
    var sectionLabel: String
    var image: String?
    var readingMinutes: Int
    var reason: Reason?

    enum CodingKeys: String, CodingKey { case id, href, title, excerpt, sectionLabel, image, readingMinutes, reason }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        href = try c.decodeIfPresent(String.self, forKey: .href) ?? ""
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        excerpt = try c.decodeIfPresent(String.self, forKey: .excerpt) ?? ""
        sectionLabel = try c.decodeIfPresent(String.self, forKey: .sectionLabel) ?? ""
        image = try c.decodeIfPresent(String.self, forKey: .image)
        readingMinutes = try c.decodeIfPresent(Int.self, forKey: .readingMinutes) ?? 1
        reason = try? c.decodeIfPresent(Reason.self, forKey: .reason)
    }

    /// بطاقة للصفوف المشتركة — القسم من المسار المقدس `/section/id/slug`.
    var asCard: StoryCard {
        let parts = href.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        let section = parts.count >= 3 ? parts[0] : "news"
        let slug = parts.count >= 3 ? parts[2] : id
        return StoryCard(
            id: id, slug: slug, section: section, title: title, excerpt: excerpt,
            eyebrow: sectionLabel, readingMinutes: readingMinutes, image: image, href: href
        )
    }
}

struct RelatedPayload: Codable, Sendable {
    var items: [RelatedItem]
    var personalized: Bool
    enum CodingKeys: String, CodingKey { case items, personalized }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = (try? c.decodeIfPresent([RelatedItem].self, forKey: .items)) ?? []
        personalized = try c.decodeIfPresent(Bool.self, forKey: .personalized) ?? false
    }
}

/// تحليل ISO 8601 (بكسور الثواني أو بدونها، وبإزاحة `+03:00`) — مشترك بين النماذج والشاشات.
enum ElmDates {
    static func parse(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let frac = ISO8601DateFormatter()
        frac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = frac.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: iso)
    }
}
struct HomeWebStream: Codable, Sendable {
    var river: [StoryCard]
    var pulse: HomePulse
    var panels: [HomeSectionPanel]
    var infographics: [StoryCard]
}
struct HomePulse: Codable, Sendable {
    var todayCount: Int
    var lastAt: String?
}
struct HomeSectionPanel: Codable, Identifiable, Sendable {
    var slug: String
    var name: String
    var color: String
    var lead: StoryCard?
    var rows: [StoryCard]
    var todayCount: Int
    var id: String { slug }
}
