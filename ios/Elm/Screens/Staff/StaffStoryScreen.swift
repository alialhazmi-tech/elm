import SwiftUI

/// صفحة المادة داخل اللوحة: الحالة والبيانات والإجراءات بحسب الصلاحية، ومداخل التحرير
/// والفريق والسجل الزمني وسجل النسخ. الإجراءات تحمل `expectedVersion` وتعرض 409 كتعارض صريح.
/// مواد «جاك العلم» لا تُحرَّر من هنا (متنها إسقاط من الشرائح) — تُعرض بياناتها مع إشعار.
struct StaffStoryScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    let id: String
    var seed: StaffStoryRow? = nil

    @State private var payload: StaffStoryPayload?
    @State private var error: ElmAPIError?
    @State private var busy: String?
    @State private var notice: String?
    @State private var archiveReason = ""
    @State private var showArchive = false
    @State private var showSchedule = false
    @State private var scheduleDate = Date().addingTimeInterval(3600)
    @State private var showDelete = false
    @State private var showReturn = false
    @State private var showReturnToDraft = false
    @State private var returnReason = ""
    @State private var editorPresented = false
    @State private var readerPresented = false

    /// رقائق أسباب الأرشفة كما في `story-actions.tsx`.
    static let archiveReasonChips = [
        "خطأ وقائعي يحتاج تصحيحًا",
        "تكرار لمادة أخرى",
        "طلب إزالة أو تحديث رسمي",
        "لم تعد صالحة للنشر",
    ]

    private var story: StaffStory? { payload?.story }
    private var capabilities: StaffCapabilities? {
        payload?.capabilities ?? staff.actor.map { StaffCapabilities(actor: $0, story: story) }
    }

    var body: some View {
        StaffScreen(title: "المادة", showBack: true, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 18) {
                if let story {
                    head(story)
                    if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                    if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                    actions(story)
                    facts(story)
                    links(story)
                } else if let error {
                    StaffErrorView(error: error) { Task { await load() } }
                } else {
                    if let seed { Text(seed.displayTitle).font(ElmFonts.display(.title3, weight: .bold)).foregroundStyle(ElmTheme.ink) }
                    ProgressView("جارٍ تحميل المادة").frame(maxWidth: .infinity).padding(30)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 10)
        }
        .task {
            await load()
            #if DEBUG
            await runDebugAction()
            #endif
        }
        .navigationDestination(isPresented: $editorPresented) {
            if let story { StaffEditorScreen(storyId: story.id, isNew: false, initial: story, onSaved: { Task { await load() } }) }
        }
        .sheet(isPresented: $readerPresented) {
            if let story {
                NavigationStack {
                    StaffPreviewScreen(story: story)
                }.elmRTL()
            }
        }
        .sheet(isPresented: $showArchive) {
            StaffReasonSheet(
                title: "أرشفة المادة",
                message: "تختفي المادة من الموقع فورًا ويُسجَّل السبب باسمك. اختر سببًا جاهزًا أو اكتب سببك.",
                placeholder: "سبب الأرشفة",
                chips: Self.archiveReasonChips,
                minLength: 8,
                maxLength: 4000,
                confirmTitle: "أرشفة",
                destructive: true,
                reason: $archiveReason
            ) {
                Task { await run("archive") { try await StaffAPI.archive(id: id, reason: archiveReason) } }
            }.elmRTL()
        }
        .sheet(isPresented: $showReturn) {
            StaffReasonSheet(
                title: "إعادة المادة للتعديل",
                message: "تعود المادة مسودة إلى كاتبها مع ملاحظتك. حدّد التعديل المطلوب وأضف روابط المصادر عند الحاجة.",
                placeholder: "سبب الإعادة",
                minLength: 8,
                maxLength: 4000,
                confirmTitle: "إعادة للمحرر مع السبب",
                reason: $returnReason
            ) {
                Task {
                    await run("return") {
                        _ = try await StaffAPI.changeTeam(id: id, action: "return", body: returnReason, expectedVersion: story?.version ?? 0)
                    }
                }
            }.elmRTL()
        }
        .alert("حذف المسودة", isPresented: $showDelete) {
            Button("حذف", role: .destructive) { Task { await run("delete") { try await StaffAPI.deleteDraft(id: id) } } }
            Button("إلغاء", role: .cancel) {}
        } message: { Text("لا يمكن التراجع عن حذف المسودة.") }
        .alert("تحويل إلى مسودة", isPresented: $showReturnToDraft) {
            Button("تحويل إلى مسودة", role: .destructive) { Task { await returnToDraft() } }
            Button("إلغاء", role: .cancel) {}
        } message: { Text("تُخفى المادة عن الموقع وتعود مسودة بنصها الحالي حتى نشرها مجددًا.") }
        .sheet(isPresented: $showSchedule) { scheduleSheet.elmRTL() }
    }

    // MARK: الرأس

    private func head(_ story: StaffStory) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ElmFlow(spacing: 6) {
                StatusPill(status: story.storyStatus)
                if story.isJak { Text("جاك العلم").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.gold) }
                if story.revisionOf != nil { Text("مسودة تعديل لمادة منشورة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                if story.pinned { Label("مثبتة", systemImage: "pin.fill").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.gold) }
                if let until = story.breakingUntil, StaffFormat.parse(until).map({ $0 > Date() }) == true {
                    Label("عاجل حتى \(StaffFormat.time(until))", systemImage: "bolt.fill").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.danger)
                }
            }
            Text(story.title.isEmpty ? "مسودة بلا عنوان" : story.title)
                .font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if !story.excerpt.isEmpty {
                Text(story.excerpt).font(ElmFonts.text(.callout)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
            }
            if story.imageURL != nil {
                Color.clear.aspectRatio(16 / 9, contentMode: .fit)
                    .overlay { RemoteImage(url: story.imageURL) }
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            if story.isJak {
                StaffInlineNotice(message: StaffEditorScreen.jakNotice, symbol: "rectangle.on.rectangle.slash")
            }
            if let archive = payload?.archiveEvent {
                StaffInlineNotice(message: "أُرشفت \(StaffFormat.dateTime(archive.at))\(archive.actor.map { " بواسطة \($0)" } ?? "") — \(archive.reason)", symbol: "archivebox")
            }
        }
    }

    // MARK: الإجراءات

    @ViewBuilder
    private func actions(_ story: StaffStory) -> some View {
        let caps = capabilities
        let status = story.storyStatus
        VStack(spacing: 10) {
            // مواد جاك لا تُفتح في محرر النص — تحريرها من لوحة الويب (الشرائح).
            if caps?.canEdit == true, status != .archived, !story.isJak {
                StaffPrimaryButton(title: status == .published ? (caps?.canApprove == true ? "تحرير المادة المنشورة" : "فتح مسودة تعديل") : "تحرير المادة", symbol: "pencil") { editorPresented = true }
            }
            if status == .draft, caps?.canSubmit == true {
                StaffPrimaryButton(title: "رفع للاعتماد", symbol: "paperplane", busy: busy == "submit", tint: ElmTheme.focus) {
                    Task { await run("submit") { _ = try await StaffAPI.submit(id: id, expectedVersion: story.version) } }
                }
            }
            if [.draft, .review, .scheduled].contains(status), caps?.canApprove == true {
                StaffPrimaryButton(title: status == .review ? "اعتماد ونشر" : "نشر الآن", symbol: "checkmark.seal", busy: busy == "publish", tint: ElmTheme.hex("2a9a6e")) {
                    Task { await run("publish") { _ = try await StaffAPI.publish(id: id, expectedVersion: story.version) } }
                }
            }
            HStack(spacing: 10) {
                if [.draft, .review].contains(status), caps?.canSchedule == true {
                    StaffSecondaryButton(title: "جدولة", symbol: "calendar.badge.clock") { showSchedule = true }
                }
                // الإعادة بحسب `canReturn` من الخادم (`story.approve` + حالة الاعتماد) لا `canApprove`.
                if status == .review, caps?.canReturn == true {
                    StaffSecondaryButton(title: "إعادة للتعديل", symbol: "arrow.uturn.right") { showReturn = true }
                }
                if status == .published, caps?.canApprove == true, !story.isJak {
                    StaffSecondaryButton(title: "تحويل إلى مسودة", symbol: "doc.badge.arrow.up") { showReturnToDraft = true }
                }
            }
            HStack(spacing: 10) {
                if [.published, .review, .scheduled].contains(status), caps?.canArchive == true {
                    StaffSecondaryButton(title: "أرشفة", symbol: "archivebox", destructive: true) { showArchive = true }
                }
                if status == .archived, caps?.canRestore == true {
                    StaffSecondaryButton(title: "استعادة كمسودة", symbol: "arrow.uturn.backward") {
                        Task { await run("restore") { try await StaffAPI.restore(id: id) } }
                    }
                }
                if status == .draft, caps?.canDelete == true {
                    StaffSecondaryButton(title: "حذف المسودة", symbol: "trash", destructive: true) { showDelete = true }
                }
            }
            if busy != nil { ProgressView().frame(maxWidth: .infinity) }
        }
    }

    // MARK: البيانات

    private func facts(_ story: StaffStory) -> some View {
        StaffCard {
            fact("القسم", ElmFormat.sectionName(story.section))
            if let series = story.seriesSlug { fact("السلسلة", SeriesPalette.active.first { $0.id == series }?.name ?? series) }
            fact("الشكل", StaffTaxonomyPayload.formatLabel(story.format))
            if let author = story.authorName, !author.isEmpty { fact("الكاتب", author) }
            if let due = story.dueAt { fact("موعد التسليم", StaffFormat.dateTime(due)) }
            if let scheduled = story.scheduledAt, story.storyStatus == .scheduled { fact("موعد النشر", StaffFormat.dateTime(scheduled)) }
            if let published = story.publishedAt { fact("نُشرت", StaffFormat.dateTime(published)) }
            if let updated = story.updatedAt { fact("آخر تحديث", StaffFormat.dateTime(updated)) }
            fact("الإصدار", ElmFormat.latinDigits(String(story.version)))
            if !story.keywords.isEmpty { fact("الكلمات المفتاحية", story.keywords.joined(separator: "، ")) }
            if let video = story.videoUrl, !video.isEmpty { fact("الفيديو", video) }
        }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(label).font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3).frame(width: 96, alignment: .leading)
            Text(value).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).textSelection(.enabled)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private func links(_ story: StaffStory) -> some View {
        VStack(spacing: 0) {
            Button { readerPresented = true } label: { StaffMenuRow(title: "معاينة المادة", detail: "كما ستظهر في التطبيق", symbol: "eye") }.buttonStyle(.plain)
            Divider().overlay(ElmTheme.line).padding(.leading, 60)
            NavigationLink { StaffTeamScreen(storyId: story.id, version: story.version, canAssign: capabilities?.canAssign ?? false) } label: {
                StaffMenuRow(title: "الفريق والملاحظات", detail: story.assignedTo == nil ? "بلا إسناد" : "مسندة", symbol: "person.2")
            }.buttonStyle(.plain)
            Divider().overlay(ElmTheme.line).padding(.leading, 60)
            NavigationLink { StaffTimelineScreen(storyId: story.id) } label: { StaffMenuRow(title: "السجل الزمني", symbol: "clock.arrow.circlepath") }.buttonStyle(.plain)
            Divider().overlay(ElmTheme.line).padding(.leading, 60)
            NavigationLink { StaffHistoryScreen(storyId: story.revisionOf ?? story.id, currentVersion: story.version, status: story.status, isRevision: story.revisionOf != nil) } label: {
                StaffMenuRow(title: "سجل النسخ", symbol: "doc.on.doc")
            }.buttonStyle(.plain)
            if story.storyStatus == .published {
                Divider().overlay(ElmTheme.line).padding(.leading, 60)
                ShareLink(item: URLConstants.publicURL(path: story.publicPath)) {
                    StaffMenuRow(title: "مشاركة الرابط العام", detail: story.publicPath, symbol: "square.and.arrow.up")
                }.buttonStyle(.plain)
            }
        }
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }

    private var scheduleSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Text("موعد النشر بتوقيت الرياض").font(ElmFonts.display(.title3, weight: .bold)).foregroundStyle(ElmTheme.ink)
                DatePicker("الموعد", selection: $scheduleDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
                    .riyadhPicker()
                    .tint(ElmTheme.navyInk)
                Text("يُنشر \(StaffFormat.dateTime(StaffFormat.iso(scheduleDate))) بتوقيت الرياض بعد تجاوز الحارس.")
                    .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                StaffPrimaryButton(title: "تأكيد الجدولة", symbol: "calendar.badge.checkmark", busy: busy == "schedule") {
                    showSchedule = false
                    Task { await run("schedule") { _ = try await StaffAPI.schedule(id: id, at: StaffFormat.iso(scheduleDate), expectedVersion: story?.version ?? 0) } }
                }
                Spacer()
            }
            .padding(22)
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { showSchedule = false } } }
        }
        .presentationDetents([.large])
    }

    #if DEBUG
    /// تنفيذ إجراء من وسائط الإطلاق — للتحقق الآلي على المحاكي فقط.
    private func runDebugAction() async {
        guard let action = ElmLaunch.staffAction, story != nil, ElmLaunch.staffStory == id else { return }
        try? await Task.sleep(for: .milliseconds(600))
        switch action {
        case "submit": await run("submit") { _ = try await StaffAPI.submit(id: id, expectedVersion: story?.version ?? 0) }
        case "publish": await run("publish") { _ = try await StaffAPI.publish(id: id, expectedVersion: story?.version ?? 0) }
        case "archive": archiveReason = "أرشفة تجريبية من تطبيق iOS"; await run("archive") { try await StaffAPI.archive(id: id, reason: archiveReason) }
        case "restore": await run("restore") { try await StaffAPI.restore(id: id) }
        case "return": returnReason = "إعادة تجريبية من التطبيق — راجع الفقرة الثانية"; await run("return") { _ = try await StaffAPI.changeTeam(id: id, action: "return", body: returnReason, expectedVersion: story?.version ?? 0) }
        case "unpublish": await returnToDraft()
        case "edit", "open", "keepmine": editorPresented = true
        default: break
        }
    }
    #endif

    // MARK: التنفيذ

    private func load() async {
        do {
            payload = try await StaffAPI.story(id: id)
            error = nil
        } catch {
            self.error = staff.handle(error)
        }
    }

    /// «تحويل إلى مسودة»: حفظ الحقول الحالية مع `returnToDraft:true` و`expectedVersion` — تُخفى المادة عن الموقع (كما `action-bar.tsx`).
    private func returnToDraft() async {
        guard let story else { return }
        await run("unpublish") {
            _ = try await StaffAPI.save(story, expectedVersion: story.version, autosave: false, returnToDraft: true)
        }
    }

    private func run(_ name: String, _ work: () async throws -> Void) async {
        busy = name
        error = nil
        notice = nil
        defer { busy = nil }
        do {
            try await work()
            notice = successMessage(name)
            archiveReason = ""
            returnReason = ""
            await load()
        } catch {
            let api = staff.handle(error)
            if case .guardBlocked(let text, let blocking) = api {
                self.error = .guardBlocked(([text] + blocking).filter { !$0.isEmpty }.joined(separator: "\n"), blocking: blocking)
            } else if case .conflict = api {
                self.error = .conflict("تغيّرت المادة منذ فتحها — حُدّثت النسخة المعروضة، راجعها ثم أعد المحاولة.")
                await load()
            } else {
                self.error = api
            }
        }
    }

    private func successMessage(_ name: String) -> String {
        switch name {
        case "submit": "رُفعت المادة للاعتماد."
        case "publish": "نُشرت المادة."
        case "schedule": "جُدولت المادة."
        case "archive": "أُرشفت المادة."
        case "restore": "استُعيدت المادة كمسودة."
        case "delete": "حُذفت المسودة."
        case "return": "أُعيدت المادة إلى كاتبها."
        case "unpublish": "حُوّلت المادة إلى مسودة وأُخفيت عن الموقع."
        default: "تم."
        }
    }
}

/// معاينة المادة بقارئ التطبيق نفسه — للمواد غير المنشورة التي لا يعرفها الموقع العام.
struct StaffPreviewScreen: View {
    let story: StaffStory
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    StatusPill(status: story.storyStatus)
                    Spacer()
                    Button("إغلاق") { dismiss() }.font(ElmFonts.text(.footnote, weight: .semibold))
                }
                Text(story.title).font(ElmFonts.display(size: 25, weight: .semibold, relativeTo: .title2)).foregroundStyle(ElmTheme.ink).lineSpacing(5)
                if !story.excerpt.isEmpty { Text(story.excerpt).font(ElmFonts.text(.callout)).foregroundStyle(ElmTheme.ink2).lineSpacing(4) }
                if story.imageURL != nil {
                    Color.clear.aspectRatio(1.95, contentMode: .fit).overlay { RemoteImage(url: story.imageURL) }
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                ArticleBodyView(blocks: ArticleBlocks.parse(html: story.body), fontSize: 17)
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }
}
