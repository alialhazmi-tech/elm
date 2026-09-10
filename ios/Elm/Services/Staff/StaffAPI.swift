import Foundation

/// واجهة «تحرير العلم» — كل مسار يقابل ملف `app/api/tahrir/*` والبوابة على الخادم.
/// أي 401 يمرّ عبر `StaffSessionStore.expire()` من المستدعي حتى تظهر شاشة الدخول فوق العمل الجاري.
enum StaffAPI {
    private static var origin: URL { URLConstants.staffAPI }
    private static func url(_ path: String, _ query: [String: String?] = [:]) -> URL {
        ElmHTTP.url(origin, "api/tahrir/\(path)", query: query)
    }

    // MARK: الجلسة

    static func login(username: String, password: String, code: String?) async throws -> StaffLoginResult {
        var body: [String: Any] = ["username": username, "password": password]
        if let code, !code.isEmpty { body["code"] = code }
        return try await ElmHTTP.send(url("login"), json: body)
    }

    static func logout() async throws {
        _ = try await ElmHTTP.request(url("logout"), method: "POST", json: [:] as [String: Any])
    }

    static func me() async throws -> StaffMePayload {
        try await ElmHTTP.get(url("me"))
    }

    static func changePassword(current: String, next: String) async throws {
        _ = try await ElmHTTP.request(url("account/password"), method: "POST", json: ["current": current, "next": next])
    }

    static func updateProfileName(_ name: String) async throws -> StaffAvatarResult {
        try await ElmHTTP.send(url("account/profile"), method: "PATCH", json: ["name": name])
    }

    static func uploadAvatar(_ file: ElmMultipartFile) async throws -> StaffAvatarResult {
        try await ElmHTTP.upload(url("account/profile"), file: file)
    }

    static func removeAvatar() async throws -> StaffAvatarResult {
        let (data, _) = try await ElmHTTP.request(url("account/profile"), method: "DELETE")
        return try ElmHTTP.decode(StaffAvatarResult.self, from: data)
    }

    static func mfa(action: String, password: String, code: String? = nil, enrollment: String? = nil) async throws -> Data {
        var body: [String: Any] = ["action": action, "password": password]
        if let code { body["code"] = code }
        if let enrollment { body["enrollment"] = enrollment }
        let (data, _) = try await ElmHTTP.request(url("account/mfa"), method: "POST", json: body)
        return data
    }

    // MARK: القراءة

    static func overview() async throws -> StaffOverviewPayload { try await ElmHTTP.get(url("overview")) }

    static func stories(status: String?, page: Int, query: String?, series: String?) async throws -> StaffStoryListPayload {
        try await ElmHTTP.get(url("story", ["status": status, "p": page > 1 ? String(page) : nil, "q": query, "series": series]))
    }

    static func story(id: String) async throws -> StaffStoryPayload { try await ElmHTTP.get(url("story/\(id)")) }

    static func tasks(filter: String, page: Int) async throws -> StaffTasksPayload {
        try await ElmHTTP.get(url("tasks", ["filter": filter, "page": page > 1 ? String(page) : nil]))
    }

    static func taxonomy() async throws -> StaffTaxonomyPayload { try await ElmHTTP.get(url("taxonomy")) }

    static func media(filter: String, page: Int, query: String?) async throws -> StaffMediaPayload {
        try await ElmHTTP.get(url("media", ["f": filter, "p": page > 1 ? String(page) : nil, "q": query]))
    }

    static func audit(limit: Int = 200) async throws -> StaffAuditPayload { try await ElmHTTP.get(url("audit", ["limit": String(limit)])) }
    static func stats() async throws -> StaffStatsPayload { try await ElmHTTP.get(url("stats")) }
    static func schedule() async throws -> StaffSchedulePayload { try await ElmHTTP.get(url("schedule")) }
    static func series() async throws -> StaffSeriesPayload { try await ElmHTTP.get(url("series")) }
    static func history(id: String) async throws -> StaffHistoryPayload { try await ElmHTTP.get(url("story/history", ["id": id])) }
    static func versionText(versionId: String) async throws -> StaffVersionText { try await ElmHTTP.get(url("story/history/\(versionId)")) }

    static func notifications(etag: String?) async throws -> (StaffNotificationsPayload?, String?) {
        let headers = etag.map { ["If-None-Match": $0] } ?? [:]
        let (data, response) = try await ElmHTTP.request(url("notifications"), headers: headers)
        if response.statusCode == 304 { return (nil, etag) }
        return (try ElmHTTP.decode(StaffNotificationsPayload.self, from: data), response.value(forHTTPHeaderField: "ETag"))
    }

    static func markNotificationsRead(ids: [String]) async throws {
        _ = try await ElmHTTP.request(url("notifications"), method: "POST", json: ["ids": ids])
    }

    static func team(id: String) async throws -> StaffTeamPayload { try await ElmHTTP.get(url("story/\(id)/team")) }

    static func timeline(id: String, cursor: String?) async throws -> StaffTimelinePayload {
        try await ElmHTTP.get(url("story/\(id)/timeline", ["cursor": cursor]))
    }

    // MARK: الكتابة

    /// حفظ/إنشاء — `POST /api/tahrir/story`. الحقول كما يرسلها المحرر على الويب حرفيًا.
    static func save(_ story: StaffStory, expectedVersion: Int?, autosave: Bool, returnToDraft: Bool = false) async throws -> StaffSaveResult {
        var body: [String: Any] = [
            "id": story.id,
            "title": story.title,
            "excerpt": story.excerpt,
            "body": story.body,
            "section": story.section,
            "slug": story.slug,
            "seriesSlug": story.seriesSlug ?? NSNull(),
            "image": story.image?.isEmpty == false ? story.image! : NSNull(),
            "format": story.format,
            "seoTitle": story.seoTitle,
            "seoDescription": story.seoDescription,
            "keywords": story.keywords,
            "videoUrl": story.videoUrl?.isEmpty == false ? story.videoUrl! : NSNull(),
            "pinned": story.pinned,
            "breakingUntil": story.breakingUntil ?? NSNull(),
            "autosave": autosave,
        ]
        if let expectedVersion, expectedVersion > 0 { body["expectedVersion"] = expectedVersion }
        if returnToDraft { body["returnToDraft"] = true }
        return try await ElmHTTP.send(url("story"), json: body, timeout: 40)
    }

    static func deleteDraft(id: String) async throws {
        _ = try await ElmHTTP.request(url("story"), method: "DELETE", json: ["id": id])
    }

    static func submit(id: String, expectedVersion: Int) async throws -> StaffVersionResult {
        try await ElmHTTP.send(url("story/submit"), json: ["id": id, "expectedVersion": expectedVersion])
    }

    static func publish(id: String, expectedVersion: Int) async throws -> StaffVersionResult {
        try await ElmHTTP.send(url("story/publish"), json: ["id": id, "expectedVersion": expectedVersion], timeout: 40)
    }

    static func schedule(id: String, at iso: String, expectedVersion: Int) async throws -> StaffVersionResult {
        try await ElmHTTP.send(url("story/schedule"), json: ["id": id, "scheduledAt": iso, "expectedVersion": expectedVersion])
    }

    static func archive(id: String, reason: String) async throws {
        _ = try await ElmHTTP.request(url("story/archive"), method: "POST", json: ["id": id, "reason": reason])
    }

    static func restore(id: String) async throws {
        _ = try await ElmHTTP.request(url("story/restore"), method: "POST", json: ["id": id])
    }

    static func restoreVersion(id: String, versionId: String, expectedVersion: Int) async throws {
        _ = try await ElmHTTP.request(url("story/history"), method: "POST", json: ["id": id, "versionId": versionId, "expectedVersion": expectedVersion])
    }

    static func changeTeam(id: String, action: String, assignedTo: String? = nil, dueAt: String? = nil, body: String? = nil, expectedVersion: Int) async throws -> Data {
        var payload: [String: Any] = ["action": action, "expectedVersion": expectedVersion]
        if let assignedTo { payload["assignedTo"] = assignedTo }
        if let dueAt { payload["dueAt"] = dueAt }
        if let body { payload["body"] = body }
        let (data, _) = try await ElmHTTP.request(url("story/\(id)/team"), method: "POST", json: payload)
        return data
    }

    static func presence(id: String, sessionId: String, leave: Bool = false) async throws {
        _ = try await ElmHTTP.request(url("story/\(id)/presence"), method: leave ? "DELETE" : "POST", json: ["sessionId": sessionId], timeout: 10)
    }

    static func uploadMedia(_ file: ElmMultipartFile) async throws -> StaffUploadResult {
        try await ElmHTTP.upload(url("media"), file: file, timeout: 120)
    }

    static func setMediaRights(id: String, cleared: Bool, flags: String) async throws {
        _ = try await ElmHTTP.request(url("media/rights"), method: "POST", json: ["id": id, "rightsCleared": cleared, "flags": flags])
    }

    static func guardReport(title: String, body: String, image: String?, format: String, breakingUntil: String?) async throws -> StaffGuardReport {
        try await ElmHTTP.send(url("guard"), json: [
            "title": title, "body": body, "image": image.map { $0 as Any } ?? NSNull(), "format": format, "breakingUntil": breakingUntil.map { $0 as Any } ?? NSNull(),
        ])
    }

    static func assist(tool: String, storyId: String?, title: String, body: String, selection: String? = nil) async throws -> StaffAIResult {
        var payload: [String: Any] = ["tool": tool, "title": title, "body": body]
        if let storyId { payload["storyId"] = storyId }
        if let selection, !selection.isEmpty { payload["selection"] = selection }
        return try await ElmHTTP.send(url("ai/assist"), json: payload, timeout: 90)
    }

    static func proposeSeries(name: String, valueCase: String, gapCase: String, impactCase: String) async throws {
        _ = try await ElmHTTP.request(url("series/proposals"), method: "POST", json: ["name": name, "valueCase": valueCase, "gapCase": gapCase, "impactCase": impactCase])
    }

    static func decideProposal(id: String, decision: String) async throws {
        _ = try await ElmHTTP.request(url("series/proposals"), method: "PATCH", json: ["id": id, "decision": decision])
    }

    static func setSeriesHidden(slug: String, hidden: Bool) async throws {
        _ = try await ElmHTTP.request(url("series/visibility"), method: "PATCH", json: ["slug": slug, "hidden": hidden])
    }

    static func setTaxonomyHidden(kind: String, slug: String, hidden: Bool) async throws {
        _ = try await ElmHTTP.request(url("taxonomy"), method: "PATCH", json: ["kind": kind, "slug": slug, "hidden": hidden])
    }

    static func settings() async throws -> StaffSettingsPayload { try await ElmHTTP.get(url("settings")) }

    static func updateGovernance(editorialGuard: Bool?, requireImageRights: Bool?) async throws -> StaffSettingsPayload {
        var governance: [String: Any] = [:]
        if let editorialGuard { governance["editorialGuard"] = editorialGuard }
        if let requireImageRights { governance["requireImageRights"] = requireImageRights }
        return try await ElmHTTP.send(url("settings"), method: "PATCH", json: ["governance": governance])
    }

    // MARK: الإدارة

    static func members() async throws -> StaffMembersPayload { try await ElmHTTP.get(url("admin/members")) }
    static func roles() async throws -> StaffRolesPayload { try await ElmHTTP.get(url("admin/roles")) }

    static func createMember(username: String, displayName: String, email: String, role: String, password: String) async throws {
        _ = try await ElmHTTP.request(url("admin/members"), method: "POST", json: ["username": username, "displayName": displayName, "email": email, "role": role, "password": password])
    }

    static func updateMember(id: String, displayName: String?, email: String?, role: String?) async throws {
        var body: [String: Any] = [:]
        if let displayName { body["displayName"] = displayName }
        if let email { body["email"] = email }
        if let role { body["role"] = role }
        _ = try await ElmHTTP.request(url("admin/members/\(id)"), method: "PATCH", json: body)
    }

    static func setMemberStatus(id: String, status: String, reason: String) async throws {
        _ = try await ElmHTTP.request(url("admin/members/\(id)/status"), method: "POST", json: ["status": status, "reason": reason])
    }

    static func resetMemberPassword(id: String, password: String) async throws {
        _ = try await ElmHTTP.request(url("admin/members/\(id)/password"), method: "POST", json: ["password": password])
    }

    static func setRolePermission(roleId: String, key: String, granted: Bool) async throws {
        _ = try await ElmHTTP.request(url("admin/roles/\(roleId)/permissions"), method: "PATCH", json: ["permissionKey": key, "granted": granted])
    }
}
