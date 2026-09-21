import SwiftUI
import PhotosUI

/// الحسابات الإدارية — `admin/members/*`: القائمة، إنشاء عضو، تعديل الدور، التعليق، إعادة كلمة المرور.
struct StaffMembersScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var members: [StaffMember] = []
    @State private var roles: [StaffRole] = []
    @State private var error: ElmAPIError?
    @State private var loading = false
    @State private var creating = false
    @State private var selected: StaffMember?
    @State private var notice: String?

    var body: some View {
        StaffScreen(title: "الحسابات الإدارية", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("الحسابات الإدارية").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Spacer()
                    if staff.can("users.manage") {
                        Button { creating = true } label: {
                            Label("عضو جديد", systemImage: "person.badge.plus").font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(.white)
                                .padding(.horizontal, 14).frame(minHeight: 40).background(ElmTheme.navy, in: Capsule())
                        }.buttonStyle(.plain)
                    }
                }
                if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                if let error, members.isEmpty { StaffErrorView(error: error) { Task { await load() } } }
                else if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                VStack(spacing: 0) {
                    ForEach(members) { member in
                        Button { selected = member } label: {
                            HStack(spacing: 12) {
                                StaffAvatar(url: member.avatarUrl, name: member.displayName, size: 40)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(member.displayName).font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.ink)
                                    Text("@\(member.username) · \(member.roleLabel ?? member.role)").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                                    if member.status == "suspended" { Text("معلّق\(member.suspendReason.map { " — \($0)" } ?? "")").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.danger) }
                                    else if let last = member.lastLoginAt { Text("آخر دخول \(StaffFormat.smart(last))").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                                }
                                Spacer()
                                Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold)).foregroundStyle(ElmTheme.ink3)
                            }
                            .padding(.vertical, 10).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        Divider().overlay(ElmTheme.line)
                    }
                }
                .padding(.horizontal, 14)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                if loading { ProgressView().frame(maxWidth: .infinity) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if members.isEmpty { await load() } }
        .sheet(item: $selected) { member in
            StaffMemberSheet(member: member, roles: roles) { message in notice = message; Task { await load() } }.elmRTL()
        }
        .sheet(isPresented: $creating) {
            StaffCreateMemberSheet(roles: roles) { message in notice = message; Task { await load() } }.elmRTL()
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            members = try await StaffAPI.members().members
            if staff.can("users.view") { roles = (try? await StaffAPI.roles().roles) ?? roles }
            error = nil
        } catch { self.error = staff.handle(error) }
    }
}

struct StaffMemberSheet: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    let member: StaffMember
    let roles: [StaffRole]
    let onDone: (String) -> Void
    @State private var displayName = ""
    @State private var email = ""
    @State private var role = ""
    @State private var reason = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 12) {
                        StaffAvatar(url: member.avatarUrl, name: member.displayName, size: 52)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(member.displayName).font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                            Text("@\(member.username)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                        }
                    }
                    if let error { StaffInlineError(message: error) }
                    if staff.can("users.manage") {
                        StaffCard {
                            StaffField(label: "الاسم المعروض", text: $displayName)
                            StaffField(label: "البريد", text: $email, keyboard: .emailAddress, ltr: true)
                            HStack {
                                Text("الدور").font(ElmFonts.text(.footnote, weight: .semibold))
                                Spacer()
                                Menu {
                                    ForEach(roles) { item in Button(item.label) { role = item.id } }
                                } label: {
                                    HStack(spacing: 6) { Text(roles.first { $0.id == role }?.label ?? role); Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold)) }
                                        .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 36)
                                }
                                .disabled(isMe)
                                .opacity(isMe ? 0.5 : 1)
                                .accessibilityLabel("الدور")
                            }
                            // الخادم يرفض تغيير دور الحساب نفسه (`admin.ts`)؛ كلمة المرور تُغيَّر من «ملفي وأمان الحساب».
                            if isMe { Text("لا يمكنك تغيير دور حسابك الحالي؛ كلمة مرورك تُغيَّر من «ملفي وأمان الحساب».").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                            StaffPrimaryButton(title: "حفظ التعديلات", symbol: "checkmark", busy: busy) { Task { await save() } }
                        }
                        if !isMe {
                            StaffCard {
                                StaffField(label: "كلمة مرور جديدة (15 محرفًا على الأقل)", text: $password, ltr: true)
                                StaffSecondaryButton(title: "إعادة تعيين كلمة المرور", symbol: "key") { Task { await resetPassword() } }
                                    .disabled(password.unicodeScalars.count < 15 || busy)
                            }
                        }
                    }
                    if staff.can("users.suspend"), member.id != staff.actor?.userId {
                        StaffCard {
                            Text(member.status == "suspended" ? "استئناف العضوية" : "تعليق العضوية").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                            StaffField(label: "السبب", text: $reason, axis: .vertical)
                            StaffSecondaryButton(title: member.status == "suspended" ? "استئناف" : "تعليق", symbol: member.status == "suspended" ? "play.circle" : "pause.circle", destructive: member.status != "suspended") {
                                Task { await setStatus(member.status == "suspended" ? "active" : "suspended") }
                            }
                            .disabled(reason.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                        }
                    }
                }
                .padding(20)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
            .onAppear { displayName = member.displayName; email = member.email ?? ""; role = member.role }
        }
    }

    private var isMe: Bool { member.id == staff.actor?.userId }

    private func run(_ success: String, _ work: () async throws -> Void) async {
        busy = true
        error = nil
        defer { busy = false }
        do { try await work(); onDone(success); dismiss() } catch { self.error = staff.handle(error).message }
    }

    private func save() async { await run("حُدّثت بيانات \(displayName).") { try await StaffAPI.updateMember(id: member.id, displayName: displayName, email: email, role: isMe ? nil : role) } }
    private func resetPassword() async { await run("أُعيد تعيين كلمة مرور \(member.displayName).") { try await StaffAPI.resetMemberPassword(id: member.id, password: password) } }
    private func setStatus(_ status: String) async { await run(status == "suspended" ? "عُلّقت العضوية." : "استُؤنفت العضوية.") { try await StaffAPI.setMemberStatus(id: member.id, status: status, reason: reason) } }
}

struct StaffCreateMemberSheet: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    let roles: [StaffRole]
    let onDone: (String) -> Void
    @State private var username = ""
    @State private var displayName = ""
    @State private var email = ""
    @State private var role = "editor"
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("عضو جديد").font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    if let error { StaffInlineError(message: error) }
                    StaffField(label: "اسم المستخدم", text: $username, keyboard: .asciiCapable, ltr: true)
                    StaffField(label: "الاسم المعروض", text: $displayName)
                    StaffField(label: "البريد", text: $email, keyboard: .emailAddress, ltr: true)
                    HStack {
                        Text("الدور").font(ElmFonts.text(.footnote, weight: .semibold))
                        Spacer()
                        Menu { ForEach(roles) { item in Button(item.label) { role = item.id } } } label: {
                            HStack(spacing: 6) { Text(roles.first { $0.id == role }?.label ?? role); Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold)) }
                                .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 36)
                        }
                    }
                    StaffField(label: "كلمة مرور مؤقتة (15 محرفًا على الأقل)", text: $password, ltr: true, hint: "يُطلب من العضو تغييرها عند أول دخول.")
                    StaffPrimaryButton(title: "إنشاء الحساب", symbol: "person.badge.plus", busy: busy) { Task { await create() } }
                        .disabled(username.isEmpty || displayName.isEmpty || password.unicodeScalars.count < 15)
                }
                .padding(20)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
        }
    }

    private func create() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await StaffAPI.createMember(username: username, displayName: displayName, email: email, role: role, password: password)
            onDone("أُنشئ حساب \(displayName).")
            dismiss()
        } catch { self.error = staff.handle(error).message }
    }
}

/// الأدوار والصلاحيات — مصفوفة قابلة للتحرير لمن يملك `roles.manage`.
struct StaffRolesScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var payload: StaffRolesPayload?
    @State private var error: ElmAPIError?
    @State private var selectedRole: String?
    @State private var busy = false

    var body: some View {
        StaffScreen(title: "الأدوار والصلاحيات", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                Text("الأدوار والصلاحيات").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                if let payload {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(payload.roles) { role in
                                ElmChip(label: "\(role.label)\(role.members.map { " \(ElmFormat.latinDigits(String($0)))" } ?? "")", selected: selectedRole == role.id) { selectedRole = role.id }
                            }
                        }.padding(.horizontal, 18)
                    }.padding(.horizontal, -18)
                    if let role = payload.roles.first(where: { $0.id == selectedRole }) {
                        if let description = role.description, !description.isEmpty { Text(description).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
                        if role.permissions.contains("*") {
                            StaffInlineNotice(message: "هذا الدور يملك الصلاحية الشاملة ولا يُقيَّد.", symbol: "star.circle")
                        } else {
                            ForEach(payload.groups ?? []) { group in
                                StaffCard {
                                    Text(group.label).font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                                    ForEach(group.permissions) { permission in
                                        HStack(spacing: 10) {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(permission.label).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                                                if let description = permission.description { Text(description).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                                            }
                                            Spacer()
                                            if staff.can("roles.manage") {
                                                ElmToggle(isOn: role.permissions.contains(permission.key)) {
                                                    Task { await toggle(role: role.id, key: permission.key, granted: !role.permissions.contains(permission.key)) }
                                                }.accessibilityLabel(permission.label)
                                            } else {
                                                Image(systemName: role.permissions.contains(permission.key) ? "checkmark.circle.fill" : "circle").foregroundStyle(role.permissions.contains(permission.key) ? ElmTheme.tealInk : ElmTheme.ink3)
                                            }
                                        }
                                        .padding(.vertical, 3)
                                    }
                                }
                            }
                        }
                    }
                } else if error == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(30)
                }
                if busy { ProgressView().frame(maxWidth: .infinity) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if payload == nil { await load() } }
    }

    private func load() async {
        do {
            payload = try await StaffAPI.roles()
            if selectedRole == nil { selectedRole = payload?.roles.first?.id }
            error = nil
        } catch { self.error = staff.handle(error) }
    }

    private func toggle(role: String, key: String, granted: Bool) async {
        busy = true
        defer { busy = false }
        do { try await StaffAPI.setRolePermission(roleId: role, key: key, granted: granted); await load() } catch { self.error = staff.handle(error) }
    }
}

/// ملفي وأمان الحساب — الاسم والصورة وكلمة المرور والتحقق بخطوتين.
struct StaffProfileScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var name = ""
    @State private var current = ""
    @State private var next = ""
    @State private var confirm = ""
    @State private var busy = false
    @State private var error: String?
    @State private var notice: String?
    @State private var uploader = StaffMediaUploader()
    @State private var picked: PhotosPickerItem?

    var body: some View {
        StaffScreen(title: "ملفي وأمان الحساب", showBack: showBack) {
            VStack(alignment: .leading, spacing: 16) {
                if let actor = staff.actor {
                    HStack(spacing: 14) {
                        StaffAvatar(url: actor.avatarUrl, name: actor.displayName, size: 64)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(actor.displayName).font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                            Text("\(actor.roleLabel ?? actor.role) · @\(actor.username)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                            HStack(spacing: 10) {
                                PhotosPicker(selection: $picked, matching: .images) { Text("تغيير الصورة").font(ElmFonts.text(.caption, weight: .semibold)) }
                                if actor.avatarUrl != nil { Button("إزالة") { Task { await removeAvatar() } }.font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.danger) }
                            }
                        }
                    }
                }
                if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                if let error { StaffInlineError(message: error) }
                if let status = uploader.status { StaffInlineNotice(message: status) }
                StaffCard {
                    StaffField(label: "الاسم المعروض", text: $name, hint: "\(ElmFormat.latinDigits(String(name.count)))/80 · حرفان على الأقل")
                        .onChange(of: name) { _, value in if value.count > 80 { name = String(value.prefix(80)) } }
                    StaffPrimaryButton(title: "حفظ الاسم", symbol: "checkmark", busy: busy) { Task { await saveName() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).count < 2 || name.trimmingCharacters(in: .whitespaces).count > 80)
                }
                StaffCard {
                    Text("تغيير كلمة المرور").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                    StaffSecureField(label: "الحالية", text: $current)
                    StaffSecureField(label: "الجديدة (15 محرفًا على الأقل)", text: $next, contentType: .newPassword)
                    StaffSecureField(label: "تأكيد الجديدة", text: $confirm, contentType: .newPassword)
                    Text("تغيير كلمة المرور يُنهي كل الجلسات الأخرى.").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                    StaffSecondaryButton(title: "تغيير كلمة المرور", symbol: "key") { Task { await changePassword() } }
                        .disabled(current.isEmpty || next.unicodeScalars.count < 15 || next != confirm || busy)
                }
                StaffMFASetupView()
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .onAppear { name = staff.actor?.displayName ?? "" }
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task { await uploadAvatar(item); picked = nil }
        }
    }

    private func saveName() async {
        busy = true
        error = nil
        defer { busy = false }
        do { _ = try await StaffAPI.updateProfileName(name.trimmingCharacters(in: .whitespaces)); await staff.restore(); notice = "حُفظ الاسم." } catch { self.error = staff.handle(error).message }
    }

    private func changePassword() async {
        busy = true
        error = nil
        defer { busy = false }
        if await staff.changePassword(current: current, next: next) {
            notice = "غُيّرت كلمة المرور."
            current = ""; next = ""; confirm = ""
        } else {
            error = staff.errorMessage
        }
    }

    private func uploadAvatar(_ item: PhotosPickerItem) async {
        error = nil
        guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.85) else {
            error = "تعذر قراءة الصورة."
            return
        }
        do {
            _ = try await StaffAPI.uploadAvatar(ElmMultipartFile(field: "file", filename: "avatar.jpg", mime: "image/jpeg", data: jpeg))
            await staff.restore()
            notice = "حُدّثت الصورة."
        } catch { self.error = staff.handle(error).message }
    }

    private func removeAvatar() async {
        do { _ = try await StaffAPI.removeAvatar(); await staff.restore(); notice = "أُزيلت الصورة." } catch { self.error = staff.handle(error).message }
    }
}

/// التحقق بخطوتين — `account/mfa`: بدء (سر + رابط تسجيل)، تفعيل برمز، تعطيل.
struct StaffMFASetupView: View {
    @Environment(StaffSessionStore.self) private var staff
    @State private var password = ""
    @State private var code = ""
    @State private var secret: String?
    @State private var enrollment: String?
    @State private var recoveryCodes: [String] = []
    @State private var busy = false
    @State private var error: String?
    @State private var notice: String?

    private var enabled: Bool { staff.actor?.mfaEnabled ?? false }

    var body: some View {
        StaffCard {
            HStack {
                Text("التحقق بخطوتين").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                Spacer()
                Text(enabled ? "مفعّل" : "غير مفعّل").font(ElmFonts.text(.caption2, weight: .bold)).foregroundStyle(enabled ? ElmTheme.tealInk : ElmTheme.ink3)
            }
            if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
            if let error { StaffInlineError(message: error) }
            if !recoveryCodes.isEmpty {
                Text("رموز الاسترداد — احفظها الآن؛ لن تُعرض مجددًا:").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                Text(recoveryCodes.joined(separator: "\n")).font(.system(.footnote, design: .monospaced)).textSelection(.enabled).environment(\.layoutDirection, .leftToRight)
            }
            StaffSecureField(label: "كلمة المرور للتأكيد", text: $password)
            if enabled {
                StaffSecondaryButton(title: "تعطيل التحقق بخطوتين", symbol: "shield.slash", destructive: true) { Task { await disable() } }.disabled(password.isEmpty || busy)
            } else if let secret {
                Text("أضف هذا السر إلى تطبيق المصادقة ثم أدخل الرمز:").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
                Text(secret).font(.system(.footnote, design: .monospaced)).textSelection(.enabled).environment(\.layoutDirection, .leftToRight)
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading).background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10))
                if let enrollment, let url = URL(string: enrollment) {
                    Link("فتح في تطبيق المصادقة", destination: url).font(ElmFonts.text(.caption, weight: .semibold))
                }
                StaffField(label: "رمز التحقق", placeholder: "123456", text: $code, keyboard: .numberPad, ltr: true)
                StaffPrimaryButton(title: "تفعيل", symbol: "checkmark.shield", busy: busy) { Task { await enable() } }.disabled(code.count < 6)
            } else {
                StaffSecondaryButton(title: "بدء التفعيل", symbol: "shield.lefthalf.filled") { Task { await begin() } }.disabled(password.isEmpty || busy)
            }
        }
    }

    private func begin() async {
        busy = true; error = nil; notice = nil
        defer { busy = false }
        do {
            let data = try await StaffAPI.mfa(action: "begin", password: password)
            let payload = try ElmHTTP.decode(StaffMFABegin.self, from: data)
            secret = payload.secret
            enrollment = payload.enrollment
        } catch { self.error = staff.handle(error).message }
    }

    private func enable() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let data = try await StaffAPI.mfa(action: "enable", password: password, code: code.trimmingCharacters(in: .whitespaces), enrollment: enrollment)
            let result = try ElmHTTP.decode(StaffMFAResult.self, from: data)
            recoveryCodes = result.recoveryCodes ?? []
            secret = nil
            code = ""
            password = ""
            notice = "فُعّل التحقق بخطوتين."
            await staff.restore()
        } catch { self.error = staff.handle(error).message }
    }

    private func disable() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            _ = try await StaffAPI.mfa(action: "disable", password: password)
            password = ""
            recoveryCodes = []
            notice = "عُطّل التحقق بخطوتين."
            await staff.restore()
        } catch { self.error = staff.handle(error).message }
    }
}
