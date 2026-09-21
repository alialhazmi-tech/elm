import SwiftUI

/// الفريق والملاحظات — `GET/POST /api/tahrir/story/:id/team`: الإسناد وموعد التسليم والملاحظات.
struct StaffTeamScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    let storyId: String
    @State var version: Int
    var canAssign: Bool
    @State private var payload: StaffTeamPayload?
    @State private var error: ElmAPIError?
    @State private var comment = ""
    @State private var busy = false
    @State private var assignee = ""
    @State private var dueEnabled = false
    @State private var dueDate = Date().addingTimeInterval(86_400)

    var body: some View {
        StaffScreen(title: "الفريق والملاحظات", showBack: true, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 16) {
                if let payload {
                    if canAssign || payload.canAssign == true { assignCard(payload) }
                    else if let name = payload.assigneeName {
                        StaffInlineNotice(message: "مسندة إلى \(name)\(payload.dueAt.map { " · التسليم \(StaffFormat.dateTime($0))" } ?? "")", symbol: "person")
                    }
                    notesCard(payload)
                } else if let error {
                    StaffErrorView(error: error) { Task { await load() } }
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(30)
                }
                if let error, payload != nil { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { await load() }
    }

    private func assignCard(_ payload: StaffTeamPayload) -> some View {
        StaffCard {
            Text("الإسناد").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            Menu {
                Button("بلا إسناد") { assignee = "" }
                ForEach(payload.editors ?? []) { editor in Button(editor.name) { assignee = editor.id } }
            } label: {
                HStack {
                    Text((payload.editors ?? []).first { $0.id == assignee }?.name ?? "اختر محررًا")
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 11, weight: .semibold))
                }
                .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.ink)
                .padding(12).background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            Toggle("موعد تسليم", isOn: $dueEnabled).font(ElmFonts.text(.footnote)).tint(ElmTheme.tealInk)
            if dueEnabled {
                DatePicker("التسليم", selection: $dueDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    .font(ElmFonts.text(.footnote))
                    .riyadhPicker()
                Text("التسليم \(StaffFormat.dateTime(StaffFormat.iso(dueDate))) بتوقيت الرياض").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            StaffPrimaryButton(title: "حفظ الإسناد", symbol: "person.badge.plus", busy: busy) { Task { await assign() } }
        }
        .onAppear {
            assignee = payload.assignedTo ?? ""
            dueEnabled = payload.dueAt != nil
            if let due = payload.dueAt.flatMap(StaffFormat.parse) { dueDate = due }
        }
    }

    private func notesCard(_ payload: StaffTeamPayload) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            StaffSectionTitle(title: "ملاحظات المراجعة", detail: "آخر \(ElmFormat.latinDigits(String(min(50, payload.notes?.count ?? 0))))")
            let notes = payload.notes ?? []
            if notes.isEmpty {
                StaffEmptyView(title: "لا ملاحظات بعد", symbol: "bubble.left")
            } else {
                ForEach(notes) { note in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(note.authorName ?? "").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink)
                            if note.kind == "return" { Text("إعادة للتعديل").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.warn) }
                            Spacer()
                            Text(StaffFormat.smart(note.createdAt)).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                        }
                        Text(note.body).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                }
            }
            StaffField(label: "ملاحظة جديدة", placeholder: "اكتب ملاحظتك للفريق", text: $comment, axis: .vertical)
            StaffSecondaryButton(title: "إرسال الملاحظة", symbol: "paperplane") { Task { await send() } }
                .disabled(comment.trimmingCharacters(in: .whitespaces).isEmpty || busy)
        }
    }

    private func load() async {
        do {
            payload = try await StaffAPI.team(id: storyId)
            if let v = payload?.version { version = v }
            error = nil
        } catch {
            let api = staff.handle(error)
            if payload == nil { self.error = api }
        }
    }

    private func assign() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let data = try await StaffAPI.changeTeam(id: storyId, action: "assign", assignedTo: assignee.isEmpty ? "" : assignee, dueAt: dueEnabled ? StaffFormat.iso(dueDate) : nil, expectedVersion: version)
            struct Reply: Decodable { var version: Int? }
            if let reply = try? JSONDecoder().decode(Reply.self, from: data), let v = reply.version { version = v }
            await load()
        } catch {
            self.error = staff.handle(error)
        }
    }

    private func send() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            _ = try await StaffAPI.changeTeam(id: storyId, action: "comment", body: comment.trimmingCharacters(in: .whitespacesAndNewlines), expectedVersion: version)
            comment = ""
            await load()
        } catch {
            self.error = staff.handle(error)
        }
    }
}

/// السجل الزمني للمادة — `GET /api/tahrir/story/:id/timeline` بمؤشر.
struct StaffTimelineScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    let storyId: String
    @State private var events: [StaffTimelineEvent] = []
    @State private var cursor: String?
    @State private var loading = false
    @State private var error: ElmAPIError?
    @State private var title = ""

    var body: some View {
        StaffScreen(title: "السجل الزمني", showBack: true, onRefresh: { await load(reset: true) }) {
            VStack(alignment: .leading, spacing: 14) {
                if !title.isEmpty { Text(title).font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink) }
                if let error, events.isEmpty { StaffErrorView(error: error) { Task { await load(reset: true) } } }
                else if events.isEmpty && !loading { StaffEmptyView(title: "لا أحداث مسجلة", symbol: "clock") }
                ForEach(events) { event in
                    HStack(alignment: .top, spacing: 12) {
                        Circle().fill(tone(event.tone)).frame(width: 9, height: 9).padding(.top, 5)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(event.label ?? event.action ?? "").font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                            Text("\(event.actorName ?? "") · \(StaffFormat.dateTime(event.at))").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                            if let detail = event.detail, !detail.isEmpty { Text(detail).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
                            if let fields = event.fields, !fields.isEmpty { Text("الحقول: \(fields.joined(separator: "، "))").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
                if loading { ProgressView().frame(maxWidth: .infinity) }
                else if cursor != nil { StaffSecondaryButton(title: "عرض المزيد", symbol: "arrow.down") { Task { await load(reset: false) } } }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if events.isEmpty { await load(reset: true) } }
    }

    private func tone(_ value: String?) -> Color {
        switch value {
        case "ok": ElmTheme.tealInk
        case "warn": ElmTheme.warn
        case "block": ElmTheme.danger
        default: ElmTheme.navyInk
        }
    }

    private func load(reset: Bool) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let payload = try await StaffAPI.timeline(id: storyId, cursor: reset ? nil : cursor)
            title = payload.title ?? title
            events = reset ? payload.events : events + payload.events
            cursor = payload.nextCursor
        } catch {
            self.error = staff.handle(error)
        }
    }
}

/// سجل النسخ — `GET /api/tahrir/story/history?id=` واستعادة نسخة كمسودة.
struct StaffHistoryScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    let storyId: String
    let currentVersion: Int
    let status: String
    let isRevision: Bool
    @State private var versions: [StaffVersion] = []
    @State private var error: ElmAPIError?
    @State private var loading = false
    @State private var expanded: String?
    @State private var texts: [String: StaffVersionText] = [:]
    @State private var notice: String?
    @State private var restoredId: String?
    @State private var restoring: String?

    var body: some View {
        StaffScreen(title: "سجل النسخ", showBack: true, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                Text("النسخ المسجلة قبل كل اعتماد جديد. الاستعادة تنشئ مسودة وتتطلب اعتمادًا جديدًا.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                if let error, versions.isEmpty { StaffErrorView(error: error) { Task { await load() } } }
                else if versions.isEmpty && !loading { StaffEmptyView(title: "لم تُسجّل نسخ سابقة بعد", detail: "يبدأ السجل من تفعيل هذه الخاصية.", symbol: "doc.on.doc") }
                ForEach(versions) { version in
                    StaffCard {
                        Text("النسخة \(ElmFormat.latinDigits(String(version.version))) · \(version.title ?? "بلا عنوان")").font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.ink)
                        Text("\(StaffFormat.dateTime(version.createdAt)) · \(version.actor ?? "")").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                        Button(expanded == version.id ? "إخفاء النص" : "عرض النص") { Task { await toggle(version) } }
                            .font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 36)
                        if expanded == version.id, let text = texts[version.id] {
                            Text(text.text ?? "").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).lineSpacing(3).textSelection(.enabled)
                        }
                        if !isRevision, ["published", "scheduled"].contains(status) {
                            StaffSecondaryButton(title: restoring == version.id ? "جارٍ إنشاء المسودة…" : "استعادة كمسودة للمراجعة", symbol: "arrow.uturn.backward") { Task { await restore(version) } }
                                .disabled(restoring != nil)
                        }
                    }
                }
                if loading { ProgressView().frame(maxWidth: .infinity) }
                if let error, !versions.isEmpty { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if versions.isEmpty { await load() } }
        // كما `history-restore.tsx`: الاستعادة تنتقل إلى مسودة الاستعادة الجديدة.
        .navigationDestination(item: $restoredId) { id in StaffStoryScreen(id: id) }
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            versions = try await StaffAPI.history(id: storyId).versions
        } catch {
            self.error = staff.handle(error)
        }
    }

    private func toggle(_ version: StaffVersion) async {
        if expanded == version.id { expanded = nil; return }
        if texts[version.id] == nil {
            do { texts[version.id] = try await StaffAPI.versionText(versionId: version.id) } catch { self.error = staff.handle(error); return }
        }
        expanded = version.id
    }

    private func restore(_ version: StaffVersion) async {
        restoring = version.id
        error = nil
        defer { restoring = nil }
        do {
            let result = try await StaffAPI.restoreVersion(id: storyId, versionId: version.id, expectedVersion: currentVersion)
            notice = "أُنشئت مسودة من النسخة \(ElmFormat.latinDigits(String(version.version)))."
            restoredId = result.id
        } catch {
            self.error = staff.handle(error)
        }
    }
}
