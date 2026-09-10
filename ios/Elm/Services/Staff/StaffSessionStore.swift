import Foundation
import Observation

/// مرحلة جلسة «تحرير العلم» — تعكس قرار `app/tahrir/(app)/layout.tsx` على الخادم.
enum StaffPhase: Equatable {
    /// لم تُفحص الجلسة بعد.
    case unknown
    case signedOut
    /// الخادم طلب رمز التحقق بخطوتين لهذه البيانات.
    case needsCode
    case mustChangePassword
    /// حساب إداري يشترط تفعيل التحقق بخطوتين قبل أي عمل.
    case mfaRequired
    case active
}

/// جلسة الموظف: الكوكي `alelm_tahrir` في `HTTPCookieStorage.shared` (12 ساعة على الخادم)؛
/// لا كلمة مرور تُخزَّن على الجهاز. اسم المستخدم الأخير فقط يُحفظ لتسهيل العودة.
@MainActor
@Observable
final class StaffSessionStore {
    private let usernameKey = "elm.staff.username"
    private let workspaceKey = "elm.staff.workspace.open"

    var phase: StaffPhase = .unknown
    var actor: StaffActor?
    var governance = StaffGovernance()
    var loading = false
    var errorMessage: String?
    /// رسالة تظهر فوق شاشة الدخول عند انتهاء الجلسة أثناء العمل.
    var expiryNotice: String?
    var lastUsername: String {
        didSet { UserDefaults.standard.set(lastUsername, forKey: usernameKey) }
    }
    /// بيانات الدخول المؤقتة بين طلب كلمة المرور وطلب رمز التحقق — في الذاكرة فقط.
    @ObservationIgnored private var pendingCredentials: (username: String, password: String)?

    /// مساحة التحرير مفتوحة فوق تبويبات القارئ.
    var workspacePresented: Bool {
        didSet { UserDefaults.standard.set(workspacePresented, forKey: workspaceKey) }
    }

    init() {
        lastUsername = UserDefaults.standard.string(forKey: usernameKey) ?? ""
        workspacePresented = UserDefaults.standard.bool(forKey: workspaceKey)
    }

    var isActive: Bool { phase == .active && actor != nil }
    var isSignedIn: Bool { actor != nil && phase != .signedOut }

    func can(_ key: String) -> Bool { actor?.can(key) ?? false }

    /// فحص الجلسة عند الإقلاع أو العودة للمقدمة.
    func restore() async {
        #if DEBUG
        if ElmLaunch.staffFresh, phase == .unknown {
            HTTPCookieStorage.shared.cookies?.filter { $0.name == "alelm_tahrir" }.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
        }
        #endif
        do {
            let payload = try await StaffAPI.me()
            apply(payload)
        } catch let error as ElmAPIError {
            if error.isUnauthorized {
                // كانت الجلسة فعّالة ثم رُفضت (خروج من جهاز آخر، تغيير كلمة مرور، تعليق) → تنبيه فوق الدخول.
                if actor != nil { expire() }
                actor = nil
                phase = .signedOut
            } else if phase == .unknown {
                // شبكة غير متاحة: نبقي آخر حالة معروفة إن وُجدت، وإلا خروج.
                phase = actor == nil ? .signedOut : phase
            }
        } catch {
            if phase == .unknown { phase = .signedOut }
        }
    }

    private func apply(_ payload: StaffMePayload) {
        actor = payload.actor
        governance = payload.governance ?? StaffGovernance()
        lastUsername = payload.actor.username
        expiryNotice = nil
        if payload.actor.mustChangePassword { phase = .mustChangePassword }
        else if payload.actor.mfaRequired { phase = .mfaRequired }
        else { phase = .active }
    }

    /// الدخول: كلمة المرور أولًا؛ إن طلب الخادم رمزًا تنتقل المرحلة إلى `needsCode` وتُعاد البيانات نفسها مع الرمز.
    func signIn(username: String, password: String, code: String? = nil) async -> Bool {
        let cleanUser = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanUser.isEmpty, !password.isEmpty else {
            errorMessage = "أدخل اسم المستخدم وكلمة المرور."
            return false
        }
        loading = true
        errorMessage = nil
        defer { loading = false }
        do {
            _ = try await StaffAPI.login(username: cleanUser, password: password, code: code)
            pendingCredentials = nil
            lastUsername = cleanUser
            await restore()
            return phase != .signedOut
        } catch let error as ElmAPIError {
            if case .unauthorized(let text) = error, phase != .needsCode, text.contains("رمز") {
                pendingCredentials = (cleanUser, password)
                phase = .needsCode
                errorMessage = nil
                return false
            }
            if case .unauthorized(let text) = error, phase == .needsCode {
                errorMessage = text.isEmpty ? "رمز التحقق غير صحيح." : text
                return false
            }
            errorMessage = error.message
            return false
        } catch {
            errorMessage = "تعذر الاتصال بخدمة الدخول. حاول بعد قليل."
            return false
        }
    }

    /// إكمال الدخول برمز التحقق بعد `needsCode`.
    func submitCode(_ code: String) async -> Bool {
        guard let pending = pendingCredentials else {
            phase = .signedOut
            return false
        }
        return await signIn(username: pending.username, password: pending.password, code: code)
    }

    func cancelCode() {
        pendingCredentials = nil
        phase = .signedOut
        errorMessage = nil
    }

    func changePassword(current: String, next: String) async -> Bool {
        loading = true
        errorMessage = nil
        defer { loading = false }
        do {
            try await StaffAPI.changePassword(current: current, next: next)
            await restore()
            return phase == .active || phase == .mfaRequired
        } catch let error as ElmAPIError {
            if error.isUnauthorized { expire() } else { errorMessage = error.message }
            return false
        } catch {
            errorMessage = "تعذر تغيير كلمة المرور."
            return false
        }
    }

    func signOut() async {
        loading = true
        defer { loading = false }
        try? await StaffAPI.logout()
        actor = nil
        pendingCredentials = nil
        phase = .signedOut
        expiryNotice = nil
        workspacePresented = false
    }

    /// انتهاء الجلسة أثناء العمل: تبقى الشاشات ومسوداتها تحت شاشة الدخول.
    func expire() {
        guard phase != .signedOut else { return }
        phase = .signedOut
        expiryNotice = "انتهت جلسة «تحرير العلم». سجّل الدخول لمتابعة ما كنت تعمل عليه."
    }

    /// يستدعيه كل مسار في اللوحة عند أي خطأ: يميّز انتهاء الجلسة ويعيد رسالة قابلة للعرض.
    @discardableResult
    func handle(_ error: Error) -> ElmAPIError {
        let api = ElmAPIError.wrap(error)
        if api.isUnauthorized { expire() }
        return api
    }
}
