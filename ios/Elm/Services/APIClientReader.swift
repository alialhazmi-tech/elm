import Foundation

/// إضافات التكافؤ 2026-09-10 عبر `ElmHTTP` — في ملف مستقل حتى يبقى `APIClient.swift` قابلًا للترجمة
/// منفردًا في اختبار العقد `tests/ios-api-contract.test.mjs`.
extension APIClient {
    // MARK: - إضافات التكافؤ 2026-09-10 (عبر ElmHTTP: أخطاء عربية موحّدة)

    static func fetchPodcasts() async throws -> PodcastsPayload {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.contentAPI, "api/mobile/v1/podcasts"))
    }

    static func fetchTaxonomy() async throws -> (TaxonomyPayload, Data) {
        let (data, _) = try await ElmHTTP.request(ElmHTTP.url(URLConstants.contentAPI, "api/mobile/v1/taxonomy"))
        return (try ElmHTTP.decode(TaxonomyPayload.self, from: data), data)
    }

    static func fetchKeyword(_ keyword: String, page: Int) async throws -> KeywordPage {
        // الكلمة تُرمَّز كمقطع مسار واحد؛ `appending(path:)` يتكفل بالمسافات والعربية.
        let base = URLConstants.contentAPI.appending(path: "api/mobile/v1/keywords").appending(path: keyword)
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "page", value: String(page))]
        return try await ElmHTTP.get(components.url ?? base)
    }

    /// فهرس جاك العلم: 36 تقريرًا كما في `/jak` على الويب.
    static func fetchJak(limit: Int = 36) async throws -> JakPayload {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.contentAPI, "api/mobile/v1/jak", query: ["limit": String(limit)]))
    }

    /// الشريط الإخباري المتناوب — يُحدَّث كل 60 ثانية وعند العودة إلى المقدمة كما على الويب.
    static func fetchNewsStrip() async throws -> [NewsStripItem] {
        let payload: NewsStripPayload = try await ElmHTTP.get(ElmHTTP.url(URLConstants.contentAPI, "api/content/news-strip"), timeout: 12)
        return payload.items
    }

    /// البحث بترقيم الصفحات (18/صفحة) — عبر `ElmHTTP` حتى يُميَّز انقطاع الشبكة عن «لا نتائج».
    static func fetchSearchPage(query: String, page: Int) async throws -> SearchPage {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.contentAPI, "api/mobile/v1/search", query: ["q": query, "page": String(page)]), timeout: 20)
    }

    /// «مؤشرات المادة» العامة — تتحدث كل 60 ثانية أثناء القراءة.
    static func fetchInsights(storyId: String) async throws -> StoryInsights {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.contentAPI, "api/content/insights", query: ["storyId": storyId]), timeout: 12)
    }

    /// «نرشّح لك»: مخصّصة للعضو بكوكي العضوية، وللزائر ترشيح عام بلا تخصيص.
    static func fetchRelated(storyId: String) async throws -> RelatedPayload {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.memberAPI, "api/me/related", query: ["storyId": storyId]), timeout: 12)
    }

    /// `tab` = saved | liked | history | nil (نظرة عامة: الإحصاءات + أول 3 محفوظات).
    static func fetchAccount(tab: String?, page: Int = 1) async throws -> AccountPayload {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.memberAPI, "api/me/account", query: ["tab": tab, "page": String(page)]))
    }

    static func setLiked(storyId: String, liked: Bool) async throws {
        try await ElmHTTP.request(ElmHTTP.url(URLConstants.memberAPI, "api/me/like"), method: "POST", json: ["storyId": storyId, "liked": liked])
    }

    static func setNewsletter(subscribed: Bool) async throws -> Bool {
        struct Reply: Decodable { var subscribed: Bool? }
        let reply: Reply = try await ElmHTTP.send(ElmHTTP.url(URLConstants.memberAPI, "api/me/newsletter"), json: ["subscribed": subscribed])
        return reply.subscribed ?? subscribed
    }

    static func fetchViewer() async throws -> ViewerPayload {
        try await ElmHTTP.get(ElmHTTP.url(URLConstants.memberAPI, "api/viewer"))
    }

    /// إشارات القراءة للعضو: `{events:[{type, storyId}]}` — 401 يُهمل عند المتصل.
    static func sendEvents(_ events: [[String: Any]]) async throws {
        try await ElmHTTP.request(ElmHTTP.url(URLConstants.memberAPI, "api/me/events"), method: "POST", json: ["events": events], timeout: 12)
    }

    /// نبضة القراءة العامة (زائر أو عضو) — تشترط ترويسة Origin، وElmHTTP يضعها من أصل الرابط.
    /// يعيد `accepted` من الخادم (false عند إيقاف التخصيص) ليتوقف النبض كما يفعل الويب.
    @discardableResult
    static func sendReading(storyId: String, sessionId: String, activeMs: Int, progress: Int) async throws -> Bool? {
        let (data, _) = try await ElmHTTP.request(
            ElmHTTP.url(URLConstants.memberAPI, "api/content/reading"),
            method: "POST",
            json: ["storyId": storyId, "sessionId": sessionId, "activeMs": activeMs, "progress": progress],
            timeout: 12
        )
        struct Reply: Decodable { var accepted: Bool? }
        return (try? JSONDecoder().decode(Reply.self, from: data))?.accepted
    }

    // MARK: Neon Auth (Better-Auth) — بلا ترويسة Origin كما في جلسة العضوية القائمة

    static func updateUserName(_ name: String) async throws {
        try await ElmHTTP.request(URLConstants.authURL("update-user"), method: "POST", json: ["name": name], origin: false)
    }

    static func changePassword(current: String, new: String) async throws {
        try await ElmHTTP.request(
            URLConstants.authURL("change-password"), method: "POST",
            json: ["currentPassword": current, "newPassword": new, "revokeOtherSessions": true], origin: false
        )
    }

    static func sendVerificationOTP(email: String) async throws {
        try await ElmHTTP.request(
            URLConstants.authURL("email-otp/send-verification-otp"), method: "POST",
            json: ["email": email, "type": "email-verification"], origin: false
        )
    }

    static func verifyEmail(email: String, otp: String) async throws {
        try await ElmHTTP.request(URLConstants.authURL("email-otp/verify-email"), method: "POST", json: ["email": email, "otp": otp], origin: false)
    }

    /// طلب بريد الاستعادة؛ الإكمال يتم على الموقع من الرابط. المسار الحديث ثم اسمه القديم.
    static func requestPasswordReset(email: String) async throws {
        let body: [String: Any] = ["email": email, "redirectTo": URLConstants.publicURL(path: "/join/reset").absoluteString]
        do {
            try await ElmHTTP.request(URLConstants.authURL("request-password-reset"), method: "POST", json: body, origin: false)
        } catch ElmAPIError.notFound {
            try await ElmHTTP.request(URLConstants.authURL("forget-password"), method: "POST", json: body, origin: false)
        }
    }

    // MARK: أدوات القارئ الذكية (للأعضاء) — `POST /api/me/ai`

    struct ReaderToolResult: Decodable {
        var text: String
        var points: [String]?
    }

    /// `tool` = summary | simplify | discuss (مع `question`). الخادم يعيد 401 للزائر و429 عند تجاوز 30/يوم.
    static func readerTool(_ tool: String, storyId: String, question: String? = nil) async throws -> ReaderToolResult {
        var body: [String: Any] = ["tool": tool, "storyId": storyId]
        if let question { body["question"] = question }
        return try await ElmHTTP.send(ElmHTTP.url(URLConstants.memberAPI, "api/me/ai"), json: body, timeout: 60)
    }
}
