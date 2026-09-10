import Foundation

// نماذج لوحة «تحرير العلم» — مطابقة لعقود `app/api/tahrir/*`.
// كل الحقول غير الجوهرية اختيارية حتى يصمد التطبيق أمام خادم أقدم أو أحدث.

struct StaffActor: Codable, Equatable, Sendable {
    var userId: String
    var username: String
    var displayName: String
    var avatarUrl: String?
    var role: String
    var roleLabel: String?
    var permissions: [String]
    var mustChangePassword: Bool
    var mfaEnabled: Bool
    var mfaRequired: Bool

    enum CodingKeys: String, CodingKey {
        case userId, username, displayName, avatarUrl, role, roleLabel, permissions, mustChangePassword, mfaEnabled, mfaRequired
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decode(String.self, forKey: .userId)
        username = try c.decodeIfPresent(String.self, forKey: .username) ?? ""
        displayName = try c.decodeIfPresent(String.self, forKey: .displayName) ?? username
        avatarUrl = try c.decodeIfPresent(String.self, forKey: .avatarUrl)
        role = try c.decodeIfPresent(String.self, forKey: .role) ?? ""
        roleLabel = try c.decodeIfPresent(String.self, forKey: .roleLabel)
        permissions = try c.decodeIfPresent([String].self, forKey: .permissions) ?? []
        mustChangePassword = try c.decodeIfPresent(Bool.self, forKey: .mustChangePassword) ?? false
        mfaEnabled = try c.decodeIfPresent(Bool.self, forKey: .mfaEnabled) ?? false
        mfaRequired = try c.decodeIfPresent(Bool.self, forKey: .mfaRequired) ?? false
    }

    func can(_ key: String) -> Bool {
        permissions.contains("*") || permissions.contains(key)
    }
}

struct StaffGovernance: Codable, Equatable, Sendable {
    var editorialGuard: Bool
    var requireImageRights: Bool

    enum CodingKeys: String, CodingKey { case editorialGuard, requireImageRights }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        editorialGuard = try c.decodeIfPresent(Bool.self, forKey: .editorialGuard) ?? false
        requireImageRights = try c.decodeIfPresent(Bool.self, forKey: .requireImageRights) ?? false
    }
    init(editorialGuard: Bool = false, requireImageRights: Bool = false) {
        self.editorialGuard = editorialGuard
        self.requireImageRights = requireImageRights
    }
}

struct StaffMePayload: Decodable {
    var actor: StaffActor
    var governance: StaffGovernance?
}

struct StaffLoginResult: Decodable {
    var ok: Bool?
    var mustChangePassword: Bool?
}

/// حالات المادة كما في `lib/tahrir/service.ts`.
enum StoryStatus: String, CaseIterable, Codable, Sendable {
    case draft, review, scheduled, published, archived

    var label: String {
        switch self {
        case .draft: "مسودة"
        case .review: "بانتظار الاعتماد"
        case .scheduled: "مجدولة"
        case .published: "منشورة"
        case .archived: "مؤرشفة"
        }
    }

    var symbol: String {
        switch self {
        case .draft: "pencil.line"
        case .review: "clock.badge.checkmark"
        case .scheduled: "calendar.badge.clock"
        case .published: "checkmark.seal.fill"
        case .archived: "archivebox"
        }
    }
}

struct StaffGuardChip: Codable, Hashable, Sendable {
    var tone: String
    var label: String
}

struct StaffSeriesBadge: Codable, Hashable, Sendable {
    var name: String
    var color: String
}

struct StaffArchiveEvent: Codable, Hashable, Sendable {
    var at: String
    var actor: String?
    var reason: String
}

/// صف قائمة المواد — `GET /api/tahrir/story` و`overview` و`schedule`.
struct StaffStoryRow: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var status: String
    var statusLabel: String?
    var section: String?
    var sectionName: String?
    var seriesSlug: String?
    var series: StaffSeriesBadge?
    var authorName: String?
    var authorId: String?
    var assignedTo: String?
    var format: String?
    var isJak: Bool?
    var image: String?
    var updatedAt: String?
    var publishedAt: String?
    var scheduledAt: String?
    var revisionOf: String?
    var dueAt: String?
    var returnedAt: String?
    var guardChip: StaffGuardChip?
    var publicHref: String?
    var canEdit: Bool?
    var archive: StaffArchiveEvent?

    enum CodingKeys: String, CodingKey {
        case id, title, status, statusLabel, section, sectionName, seriesSlug, series, authorName, authorId, assignedTo
        case format, isJak, image, updatedAt, publishedAt, scheduledAt, revisionOf, dueAt, returnedAt
        case guardChip = "guard"
        case publicHref, canEdit, archive
    }

    var storyStatus: StoryStatus { StoryStatus(rawValue: status) ?? .draft }
    var displayTitle: String { title.isEmpty ? "مسودة بلا عنوان" : title }
    var imageURL: URL? { ElmMedia.url(image) }
}

struct StaffStoryListPayload: Decodable {
    var rows: [StaffStoryRow]
    var total: Int?
    var page: Int?
    var perPage: Int?
    var counts: [String: Int]?
}

struct StaffMediaCounts: Codable, Equatable, Sendable {
    var all: Int
    var ok: Int
    var pending: Int
}

struct StaffPerDay: Codable, Identifiable, Equatable, Sendable {
    var day: String
    var count: Int
    var id: String { day }
}

struct StaffOverviewPayload: Decodable {
    var counts: [String: Int]?
    var todayCount: Int?
    var perDay: [StaffPerDay]?
    var review: [StaffStoryRow]?
    var latestPublished: [StaffStoryRow]?
    var latestDraft: [StaffStoryRow]?
    var scheduled: [StaffStoryRow]?
    var media: StaffMediaCounts?
    var nextScheduledAt: String?
}

/// المادة القابلة للتحرير — `GET /api/tahrir/story/:id`.
struct StaffStory: Codable, Equatable, Sendable {
    var id: String
    var version: Int
    var revisionOf: String?
    var status: String
    var title: String
    var excerpt: String
    var body: String
    var section: String
    var slug: String
    var seriesSlug: String?
    var image: String?
    var format: String
    var pinned: Bool
    var breakingUntil: String?
    var publishedAt: String?
    var updatedAt: String?
    var scheduledAt: String?
    var seoTitle: String
    var seoDescription: String
    var keywords: [String]
    var videoUrl: String?
    var authorName: String?
    var authorId: String?
    var assignedTo: String?
    var dueAt: String?
    var returnedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, version, revisionOf, status, title, excerpt, body, section, slug, seriesSlug, image, format, pinned
        case breakingUntil, publishedAt, updatedAt, scheduledAt, seoTitle, seoDescription, keywords, videoUrl
        case authorName, authorId, assignedTo, dueAt, returnedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        revisionOf = try c.decodeIfPresent(String.self, forKey: .revisionOf)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        excerpt = try c.decodeIfPresent(String.self, forKey: .excerpt) ?? ""
        body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        section = try c.decodeIfPresent(String.self, forKey: .section) ?? "news"
        slug = try c.decodeIfPresent(String.self, forKey: .slug) ?? ""
        seriesSlug = try c.decodeIfPresent(String.self, forKey: .seriesSlug)
        image = try c.decodeIfPresent(String.self, forKey: .image)
        format = try c.decodeIfPresent(String.self, forKey: .format) ?? "news"
        if let flag = try? c.decodeIfPresent(Bool.self, forKey: .pinned) {
            pinned = flag
        } else {
            pinned = (try? c.decodeIfPresent(Int.self, forKey: .pinned)) == 1
        }
        breakingUntil = try c.decodeIfPresent(String.self, forKey: .breakingUntil)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        scheduledAt = try c.decodeIfPresent(String.self, forKey: .scheduledAt)
        seoTitle = try c.decodeIfPresent(String.self, forKey: .seoTitle) ?? ""
        seoDescription = try c.decodeIfPresent(String.self, forKey: .seoDescription) ?? ""
        keywords = try c.decodeIfPresent([String].self, forKey: .keywords) ?? []
        videoUrl = try c.decodeIfPresent(String.self, forKey: .videoUrl)
        authorName = try c.decodeIfPresent(String.self, forKey: .authorName)
        authorId = try c.decodeIfPresent(String.self, forKey: .authorId)
        assignedTo = try c.decodeIfPresent(String.self, forKey: .assignedTo)
        dueAt = try c.decodeIfPresent(String.self, forKey: .dueAt)
        returnedAt = try c.decodeIfPresent(String.self, forKey: .returnedAt)
    }

    /// مادة جديدة فارغة للمحرر.
    static func blank(id: String = UUID().uuidString.lowercased()) -> StaffStory {
        let json = """
        {"id":"\(id)","version":0,"status":"draft","title":"","excerpt":"","body":"","section":"news","slug":"","format":"news","pinned":false,"keywords":[]}
        """
        return try! JSONDecoder().decode(StaffStory.self, from: Data(json.utf8))
    }

    var storyStatus: StoryStatus { StoryStatus(rawValue: status) ?? .draft }
    var imageURL: URL? { ElmMedia.url(image) }
    var publicPath: String { "/\(section)/\(id)/\(slug.isEmpty ? id : slug)" }
    var isNew: Bool { version == 0 }

    /// بصمة المحتوى الذي يكتبه المحرر — تغيّر الإصدار أو الحالة من الخادم ليس تعديلًا يستوجب حفظًا.
    var contentSignature: String {
        [title, excerpt, body, section, slug, seriesSlug ?? "", image ?? "", format, pinned ? "1" : "0", breakingUntil ?? "", seoTitle, seoDescription, keywords.joined(separator: "|"), videoUrl ?? ""].joined(separator: "\u{1F}")
    }
}

struct StaffCapabilities: Codable, Equatable, Sendable {
    var canEdit: Bool
    var canSubmit: Bool
    var canApprove: Bool
    var canSchedule: Bool
    var canArchive: Bool
    var canRestore: Bool
    var canDelete: Bool
    var canAssign: Bool

    enum CodingKeys: String, CodingKey { case canEdit, canSubmit, canApprove, canSchedule, canArchive, canRestore, canDelete, canAssign }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        canEdit = try c.decodeIfPresent(Bool.self, forKey: .canEdit) ?? false
        canSubmit = try c.decodeIfPresent(Bool.self, forKey: .canSubmit) ?? false
        canApprove = try c.decodeIfPresent(Bool.self, forKey: .canApprove) ?? false
        canSchedule = try c.decodeIfPresent(Bool.self, forKey: .canSchedule) ?? false
        canArchive = try c.decodeIfPresent(Bool.self, forKey: .canArchive) ?? false
        canRestore = try c.decodeIfPresent(Bool.self, forKey: .canRestore) ?? false
        canDelete = try c.decodeIfPresent(Bool.self, forKey: .canDelete) ?? false
        canAssign = try c.decodeIfPresent(Bool.self, forKey: .canAssign) ?? false
    }
    init(actor: StaffActor, story: StaffStory?) {
        let owns = story.map { $0.authorId == actor.userId || $0.assignedTo == actor.userId } ?? true
        canEdit = actor.can("story.edit.any") || (actor.can("story.edit.own") && owns) || (story == nil && actor.can("story.create"))
        canSubmit = actor.can("story.submit")
        canApprove = actor.can("story.publish")
        canSchedule = actor.can("story.schedule")
        canArchive = actor.can("story.archive")
        canRestore = actor.can("story.restore")
        canDelete = canEdit && (story?.status ?? "draft") == "draft"
        canAssign = actor.can("story.edit.any")
    }
}

struct StaffStoryPayload: Decodable {
    var story: StaffStory
    var archiveEvent: StaffArchiveEvent?
    var capabilities: StaffCapabilities?
    var historyHref: String?
}

struct StaffSaveResult: Decodable {
    var ok: Bool?
    var id: String
    var slug: String?
    var section: String?
    var version: Int
    var status: String?
    var revisionOf: String?
}

struct StaffVersionResult: Decodable {
    var ok: Bool?
    var id: String?
    var version: Int?
}

struct StaffTask: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var title: String
    var status: String
    var statusLabel: String?
    var assignedTo: String?
    var authorId: String?
    var dueAt: String?
    var returnedAt: String?
    var revisionOf: String?
    var overdue: Bool?
    var canEdit: Bool?

    var displayTitle: String { title.isEmpty ? "مسودة بلا عنوان" : title }
    var storyStatus: StoryStatus { StoryStatus(rawValue: status) ?? .draft }
}

struct StaffTasksPayload: Decodable {
    var rows: [StaffTask]
    var page: Int?
    var hasMore: Bool?
}

struct StaffNotification: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var storyId: String?
    var message: String
    var readAt: String?
    var createdAt: String
}

struct StaffNotificationsPayload: Decodable {
    var notifications: [StaffNotification]
}

struct StaffMediaItem: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var url: String
    var filename: String?
    var mime: String?
    var bytes: Int?
    var width: Int?
    var height: Int?
    var rightsCleared: Bool
    var flags: String?
    var uploadedBy: String?
    var createdAt: String?
    var aiGenerated: Bool?

    enum CodingKeys: String, CodingKey { case id, url, filename, mime, bytes, width, height, rightsCleared, flags, uploadedBy, createdAt, aiGenerated }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        url = try c.decode(String.self, forKey: .url)
        filename = try c.decodeIfPresent(String.self, forKey: .filename)
        mime = try c.decodeIfPresent(String.self, forKey: .mime)
        bytes = try c.decodeIfPresent(Int.self, forKey: .bytes)
        width = try c.decodeIfPresent(Int.self, forKey: .width)
        height = try c.decodeIfPresent(Int.self, forKey: .height)
        if let flag = try? c.decodeIfPresent(Bool.self, forKey: .rightsCleared) { rightsCleared = flag }
        else { rightsCleared = (try? c.decodeIfPresent(Int.self, forKey: .rightsCleared)) == 1 }
        flags = try c.decodeIfPresent(String.self, forKey: .flags)
        uploadedBy = try c.decodeIfPresent(String.self, forKey: .uploadedBy)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        if let flag = try? c.decodeIfPresent(Bool.self, forKey: .aiGenerated) { aiGenerated = flag }
        else { aiGenerated = (try? c.decodeIfPresent(Int.self, forKey: .aiGenerated)) == 1 }
    }
    var imageURL: URL? { ElmMedia.url(url) }
}

struct StaffMediaPayload: Decodable {
    var items: [StaffMediaItem]
    var counts: StaffMediaCounts?
    var page: Int?
    var perPage: Int?
    var total: Int?
}

struct StaffUploadResult: Decodable {
    var ok: Bool?
    var id: String?
    var url: String
}

struct StaffTaxonomySection: Codable, Identifiable, Equatable, Sendable {
    var slug: String
    var name: String
    var shortName: String?
    var color: String?
    var id: String { slug }
    var label: String { shortName ?? name }
}

struct StaffTaxonomySeries: Codable, Identifiable, Equatable, Sendable {
    var slug: String
    var name: String
    var color: String?
    var archived: Bool?
    var id: String { slug }
}

struct StaffFormatOption: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var label: String
}

struct StaffTaxonomyPayload: Decodable {
    var sections: [StaffTaxonomySection]
    var series: [StaffTaxonomySeries]
    var formats: [StaffFormatOption]?
    var visibility: [String: Bool]?

    static let defaultFormats: [StaffFormatOption] = [
        .init(id: "news", label: "خبر"), .init(id: "infographics", label: "إنفوجرافيك"), .init(id: "videos", label: "فيديو"),
        .init(id: "reports", label: "تقرير"), .init(id: "podcasts", label: "بودكاست"), .init(id: "jakalelm", label: "جاك العلم"),
    ]
}

struct StaffNote: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var kind: String?
    var body: String
    var authorName: String?
    var authorId: String?
    var createdAt: String?
}

struct StaffEditor: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var name: String
}

struct StaffTeamPayload: Decodable {
    var notes: [StaffNote]?
    var editors: [StaffEditor]?
    var assignedTo: String?
    var assigneeName: String?
    var dueAt: String?
    var returnedAt: String?
    var version: Int?
    var canAssign: Bool?
    var canReturn: Bool?
}

struct StaffTimelineEvent: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var at: String
    var actorName: String?
    var action: String?
    var label: String?
    var tone: String?
    var detail: String?
    var isRevision: Bool?
    var fields: [String]?
}

struct StaffTimelinePayload: Decodable {
    var title: String?
    var events: [StaffTimelineEvent]
    var nextCursor: String?
}

struct StaffVersion: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var version: Int
    var actor: String?
    var createdAt: String?
    var title: String?
}

struct StaffHistoryPayload: Decodable {
    var versions: [StaffVersion]
    var story: StaffHistoryStory?
    struct StaffHistoryStory: Decodable {
        var id: String
        var status: String?
        var version: Int?
        var revisionOf: String?
        var format: String?
    }
}

struct StaffVersionText: Decodable {
    var title: String?
    var text: String?
}

struct StaffAuditEntry: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var at: String
    var actor: String
    var action: String
    var storyId: String?
    var detail: String?
    var actorName: String?
    var storyTitle: String?
}

struct StaffAuditPayload: Decodable {
    var rows: [StaffAuditEntry]
}

struct StaffCountItem: Decodable, Identifiable, Equatable, Sendable {
    var slug: String?
    var seriesSlug: String?
    var name: String?
    var format: String?
    var authorName: String?
    var label: String?
    var color: String?
    var count: Int
    var week: Int?

    enum CodingKeys: String, CodingKey { case slug, seriesSlug, name, format, authorName, label, color, count, total, week }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        slug = try c.decodeIfPresent(String.self, forKey: .slug)
        seriesSlug = try c.decodeIfPresent(String.self, forKey: .seriesSlug)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        format = try c.decodeIfPresent(String.self, forKey: .format)
        authorName = try c.decodeIfPresent(String.self, forKey: .authorName)
        label = try c.decodeIfPresent(String.self, forKey: .label)
        color = try c.decodeIfPresent(String.self, forKey: .color)
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? c.decodeIfPresent(Int.self, forKey: .total) ?? 0
        week = try c.decodeIfPresent(Int.self, forKey: .week)
    }
    var id: String { slug ?? seriesSlug ?? format ?? authorName ?? name ?? label ?? UUID().uuidString }
    var display: String {
        if let label, !label.isEmpty { return label }
        if let name { return name }
        if let authorName { return authorName }
        if let series = seriesSlug ?? slug { return SeriesPalette.active.first { $0.id == series }?.name ?? series }
        return format ?? ""
    }
}

struct StaffReadingTime: Codable, Equatable, Sendable {
    var quick: Int
    var medium: Int
    var long: Int
}

struct StaffStatsPayload: Decodable {
    var counts: [String: Int]?
    var perDay: [StaffPerDay]?
    var seriesDistribution: [StaffCountItem]?
    var formatDistribution: [StaffCountItem]?
    var topAuthors: [StaffCountItem]?
    var readingTime: StaffReadingTime?
}

struct StaffSchedulePayload: Decodable {
    var scheduled: [StaffStoryRow]
    var nextScheduledAt: String?
}

struct StaffProposal: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var name: String
    var valueCase: String?
    var gapCase: String?
    var impactCase: String?
    var status: String?
    var proposedBy: String?
    var createdAt: String?
}

struct StaffSeriesRow: Codable, Identifiable, Equatable, Sendable {
    var slug: String
    var name: String
    var color: String?
    var description: String?
    var hidden: Bool?
    var archived: Bool?
    var count: Int?
    var id: String { slug }
}

struct StaffSeriesPayload: Decodable {
    var distribution: [StaffCountItem]?
    var proposals: [StaffProposal]?
    var rows: [StaffSeriesRow]?
}

struct StaffMember: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var username: String
    var displayName: String
    var avatarUrl: String?
    var email: String?
    var role: String
    var roleLabel: String?
    var status: String
    var suspendedAt: String?
    var suspendReason: String?
    var lastLoginAt: String?
    var mustChangePassword: Bool?
    var createdAt: String?
}

struct StaffMembersPayload: Decodable {
    var members: [StaffMember]
}

struct StaffRole: Codable, Identifiable, Equatable, Sendable {
    var id: String
    var label: String
    var description: String?
    var isSystem: Bool?
    var position: Int?
    var permissions: [String]
    var members: Int?
}

struct StaffPermissionDef: Codable, Identifiable, Equatable, Sendable {
    var key: String
    var label: String
    var description: String?
    var id: String { key }
}

struct StaffPermissionGroup: Codable, Identifiable, Equatable, Sendable {
    var key: String
    var label: String
    var permissions: [StaffPermissionDef]
    var id: String { key }
}

struct StaffRolesPayload: Decodable {
    var roles: [StaffRole]
    var groups: [StaffPermissionGroup]?
}

struct StaffSettingsPayload: Decodable {
    var governance: StaffGovernance
}

struct StaffAISuggestion: Decodable, Identifiable, Equatable, Sendable {
    var text: String?
    var title: String?
    var body: String?
    var guardOK: Bool?
    var id: String { text ?? title ?? body ?? UUID().uuidString }

    enum CodingKeys: String, CodingKey { case text, title, body, guardReport = "guard" }
    private struct GuardReport: Decodable { var ok: Bool? }
    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let plain = try? single.decode(String.self) {
            text = plain
            title = nil
            body = nil
            guardOK = true
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        text = try c.decodeIfPresent(String.self, forKey: .text)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        body = try c.decodeIfPresent(String.self, forKey: .body)
        guardOK = (try? c.decodeIfPresent(GuardReport.self, forKey: .guardReport))?.ok
    }
    var display: String { text ?? title ?? body ?? "" }
}

/// رد `ai/assist` — نقرأ الحقول الشائعة فقط ونتجاهل الباقي.
struct StaffAIResult: Decodable {
    var ok: Bool?
    var suggestions: [StaffAISuggestion]?
    var text: String?
    var seo: SEO?
    struct SEO: Decodable {
        var seoTitle: String?
        var seoDescription: String?
        var keywords: [String]?
    }
}

struct StaffGuardFinding: Codable, Identifiable, Equatable, Sendable {
    var ruleId: String?
    var severity: String?
    var message: String?
    var excerpt: String?
    var id: String { "\(ruleId ?? "")-\(message ?? "")-\(excerpt ?? "")" }
}

struct StaffGuardReport: Decodable {
    var findings: [StaffGuardFinding]?
    var counts: [String: Int]?
    var canRequestApproval: Bool?
}

struct StaffAvatarResult: Decodable {
    var ok: Bool?
    var image: String?
}

struct StaffMFABegin: Decodable {
    var secret: String?
    var enrollment: String?
}

struct StaffMFAResult: Decodable {
    var ok: Bool?
    var enabled: Bool?
    var recoveryCodes: [String]?
}
