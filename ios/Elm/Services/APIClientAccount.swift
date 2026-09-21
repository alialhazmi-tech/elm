import Foundation

/// مسارات الحساب المضافة في إصلاح التكافؤ 2026-09-10 (الصورة الشخصية وفحص التعليق) — عبر `ElmHTTP`.
extension APIClient {
    // MARK: - الحساب المعلّق

    /// وسيط `/api/auth/*` يعيد `get-session → null` للحساب المعلّق فلا يميّزه عن الزائر؛
    /// لكنه يعيد 403 `{error:"حساب العضوية معلّق."}` لأي مسار آخر قبل تمريره إلى Neon Auth.
    /// نستعمل `list-sessions` (قراءة بلا أثر): 403 بنص التعليق = معلّق، وأي رد آخر = غير معلّق.
    static func memberSuspended() async -> Bool {
        do {
            try await ElmHTTP.request(URLConstants.authURL("list-sessions"), timeout: 12, origin: false)
            return false
        } catch ElmAPIError.forbidden(let text, _, _) {
            return text.contains("معلّق") || text.contains("معلق")
        } catch {
            return false
        }
    }

    // MARK: - الصورة الشخصية `/api/account/avatar`

    struct AvatarReply: Decodable {
        var ok: Bool?
        var image: String?
    }

    /// رفع متعدد الأجزاء بالحقل `file`؛ الخادم يعيد ترميز الصورة (384×384 WebP) ويعيد رابطها.
    static func uploadAvatar(_ data: Data, mime: String = "image/jpeg") async throws -> String? {
        let ext = mime == "image/png" ? "png" : "jpg"
        let file = ElmMultipartFile(field: "file", filename: "avatar.\(ext)", mime: mime, data: data)
        let reply: AvatarReply = try await ElmHTTP.upload(ElmHTTP.url(URLConstants.memberAPI, "api/account/avatar"), file: file, timeout: 60)
        return reply.image
    }

    static func removeAvatar() async throws {
        try await ElmHTTP.request(ElmHTTP.url(URLConstants.memberAPI, "api/account/avatar"), method: "DELETE", timeout: 20)
    }
}
