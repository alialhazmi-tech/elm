import SwiftUI
import PhotosUI

/// محرر المادة على الجوال — نظير `components/tahrir/editor`: العنوان والموجز والمتن ببلوكات،
/// التفاصيل (القسم/السلسلة/الشكل/الصورة/الفيديو/الكلمات/SEO/التثبيت/العاجل)، الحارس الحي (600ms بعد كل تعديل)،
/// مساعد الذكاء، حفظ تلقائي كل ثانيتين للمسودات، نسخة استرداد محلية، وقفل الإصدار مع 409 صريح.
/// مواد «جاك العلم» تُعرض للقراءة فقط: متنها إسقاط من الشرائح ويُحرَّر من لوحة الويب.
struct StaffEditorScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    let storyId: String
    var isNew = false
    var initial: StaffStory? = nil
    var onSaved: (() -> Void)? = nil

    @State private var draft: StaffStory
    @State private var blocks: [EditableBlock] = [EditableBlock()]
    @State private var taxonomy: StaffTaxonomyPayload?
    @State private var loading = false
    @State private var saving = false
    @State private var dirty = false
    @State private var lastSavedAt: Date?
    @State private var error: ElmAPIError?
    @State private var notice: String?
    @State private var conflict = false
    @State private var autosaveTask: Task<Void, Never>?
    @State private var guardTask: Task<Void, Never>?
    @State private var guardReport: StaffGuardReport?
    @State private var guardBusy = false
    @State private var keywordInput = ""
    @State private var mediaPicker = false
    @State private var showRecovery = false
    @State private var recovered: StaffStory?
    @State private var aiPresented = false
    @State private var panel: Panel = .body
    @State private var breakingCustom = false
    @State private var breakingDate = Date().addingTimeInterval(2 * 3600)
    @State private var presenceId = UUID().uuidString
    @State private var heartbeatTask: Task<Void, Never>?
    @State private var coEditors: [StaffPresenceEditor] = []
    @State private var pendingAction: String?
    @State private var scheduleSheet = false
    @State private var scheduleDate = Date().addingTimeInterval(3600)
    @State private var debugActionDone = false
    @FocusState private var focusedBlock: UUID?

    static let excerptLimit = 280
    static let seoTitleLimit = 90
    static let seoTitleTarget = 60
    static let seoDescriptionLimit = 200
    static let seoDescriptionTarget = 155
    static let jakNotice = "تقارير جاك العلم تُحرَّر من لوحة الويب (الشرائح)"

    private enum Panel: String, CaseIterable, Identifiable {
        case body = "المتن", details = "التفاصيل", seo = "SEO", guardPanel = "الحارس"
        var id: String { rawValue }
    }

    init(storyId: String, isNew: Bool = false, initial: StaffStory? = nil, onSaved: (() -> Void)? = nil) {
        self.storyId = storyId
        self.isNew = isNew
        self.initial = initial
        self.onSaved = onSaved
        _draft = State(initialValue: initial ?? StaffStory.blank(id: storyId))
    }

    private var capabilities: StaffCapabilities { StaffCapabilities(actor: staff.actor ?? placeholderActor, story: draft.isNew ? nil : draft) }
    private var placeholderActor: StaffActor { try! JSONDecoder().decode(StaffActor.self, from: Data(#"{"userId":"","permissions":[]}"#.utf8)) }
    private var readOnly: Bool { draft.isJak }
    /// القسم والرابط ثابتان بعد النشر وفي مسودات التعديل (كما `identityLocked` على الويب) — الخادم يتجاهل تغييرهما.
    private var identityLocked: Bool { !draft.isNew && (draft.publishedAt != nil || draft.revisionOf != nil || draft.storyStatus != .draft) }
    private var hasContent: Bool { !draft.title.trimmingCharacters(in: .whitespaces).isEmpty || !EditorMarkup.plainText(blocks).isEmpty }
    /// الحفظ التلقائي للمسودات فقط، وللمادة الجديدة بعد أول عنوان أو متن (الخادم يرفض المسودة الفارغة).
    private var canAutosave: Bool { !readOnly && (draft.storyStatus == .draft || draft.isNew) && (!draft.isNew || hasContent) }
    private var blockingCount: Int { (guardReport?.findings ?? []).filter { $0.severity == "blocking" }.count }
    private var updatesPublished: Bool { draft.storyStatus == .published && capabilities.canApprove }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if loading { ProgressView("جارٍ تحميل المادة").frame(maxWidth: .infinity).padding(20) }
                    statusLine
                    if readOnly { StaffInlineNotice(message: Self.jakNotice, symbol: "rectangle.on.rectangle.slash") }
                    if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                    if let error, !conflict { StaffInlineError(message: error.message) }
                    if conflict { conflictBanner }
                    if !coEditors.isEmpty {
                        StaffInlineNotice(message: "\(coEditors.map(\.name).joined(separator: "، ")) يحرر هذه المادة الآن. نسّق التعديلات قبل الحفظ لتجنب تعارض النسخ.", symbol: "person.2")
                    }
                    Group {
                        titleField
                        excerptField
                        Picker("القسم", selection: $panel) {
                            ForEach(Panel.allCases) { item in Text(item.rawValue).tag(item) }
                        }
                        .pickerStyle(.segmented)
                        switch panel {
                        case .body: bodyEditor
                        case .details: detailsPanel
                        case .seo: seoPanel
                        case .guardPanel: guardPanelView
                        }
                    }
                    .disabled(readOnly)
                    if !readOnly { actionBar }
                }
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await bootstrap() }
        .onDisappear {
            autosaveTask?.cancel()
            guardTask?.cancel()
            heartbeatTask?.cancel()
            if dirty { persistRecovery() }
            let id = draft.id, session = presenceId
            if !draft.isNew { Task { try? await StaffAPI.leavePresence(id: id, sessionId: session) } }
        }
        .onChange(of: scenePhase) { _, phase in
            // النبض في المقدمة فقط (كما `visibilityState` على الويب).
            if phase == .active { startHeartbeat() } else { heartbeatTask?.cancel(); heartbeatTask = nil }
        }
        .onChange(of: draft) { old, new in if old.contentSignature != new.contentSignature { markDirty() } }
        .onChange(of: blocks) { _, _ in draft.body = EditorMarkup.html(from: blocks) }
        .onChange(of: draft.excerpt) { _, value in if value.count > Self.excerptLimit { draft.excerpt = String(value.prefix(Self.excerptLimit)) } }
        .onChange(of: draft.seoTitle) { _, value in if value.count > Self.seoTitleLimit { draft.seoTitle = String(value.prefix(Self.seoTitleLimit)) } }
        .onChange(of: draft.seoDescription) { _, value in if value.count > Self.seoDescriptionLimit { draft.seoDescription = String(value.prefix(Self.seoDescriptionLimit)) } }
        .sheet(isPresented: $mediaPicker) {
            StaffMediaPickerSheet { url in draft.image = url }.elmRTL()
        }
        .sheet(isPresented: $aiPresented) {
            // النص الخام للذكاء بلا استبدال أرقام ولا ترميز؛ التطبيق يعود فقرةً بفقرة على بلوكات الفقرات.
            StaffAIPanel(storyId: draft.isNew ? nil : draft.id, title: draft.title, bodyText: EditorMarkup.plainText(blocks), taxonomy: taxonomy) { result in
                switch result {
                case .title(let text): draft.title = text
                case .excerpt(let text): draft.excerpt = String(text.prefix(Self.excerptLimit))
                case .seo(let title, let description, let keywords):
                    if let title { draft.seoTitle = String(title.prefix(Self.seoTitleLimit)) }
                    if let description { draft.seoDescription = String(description.prefix(Self.seoDescriptionLimit)) }
                    if let keywords, !keywords.isEmpty { draft.keywords = Array(keywords.prefix(12)) }
                case .bodyText(let text):
                    blocks = EditorMarkup.applyPlainText(text, onto: blocks)
                case .classify(let seriesSlug, let section, let format):
                    if let seriesSlug, !seriesSlug.isEmpty { draft.seriesSlug = seriesSlug }
                    if let section, !section.isEmpty, !identityLocked { draft.section = section }
                    if let format, !format.isEmpty, format != "jakalelm" { draft.format = format }
                }
            }.elmRTL()
        }
        .sheet(isPresented: $scheduleSheet) { scheduleSheetView.elmRTL() }
        .alert("نسخة محلية أحدث", isPresented: $showRecovery) {
            Button("استعادة نسختي") { if let recovered { apply(recovered) }; clearRecovery() }
            Button("تجاهلها", role: .cancel) { clearRecovery() }
        } message: { Text("وُجدت تعديلات لم تُحفظ على هذا الجهاز منذ آخر جلسة. هل تريد استعادتها؟") }
    }

    // MARK: الشريط العلوي

    private var saveTitle: String {
        if draft.storyStatus == .published { return capabilities.canApprove ? "تحديث المادة" : "حفظ مسودة التعديل" }
        return "حفظ"
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            Button { leave() } label: {
                Image(systemName: "arrow.right").font(.system(size: 15, weight: .semibold)).frame(width: 44, height: 44)
            }.accessibilityLabel("رجوع")
            VStack(alignment: .leading, spacing: 1) {
                Text(draft.isNew ? "مادة جديدة" : (readOnly ? "مادة جاك العلم" : "تحرير المادة")).font(ElmFonts.text(.subheadline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                Text(readOnly ? "للقراءة فقط" : saveStatus).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            Spacer()
            if staff.can("ai.assist"), !readOnly {
                Button { aiPresented = true } label: {
                    Image(systemName: "sparkles").font(.system(size: 17)).frame(width: 44, height: 44)
                }.accessibilityLabel("مساعد الذكاء")
            }
            if !readOnly {
                Button { Task { if updatesPublished { await updatePublished() } else { await save(autosave: false) } } } label: {
                    HStack(spacing: 6) {
                        if saving || pendingAction == "update" { ProgressView().tint(.white) } else { Image(systemName: "checkmark") }
                        Text(saveTitle)
                    }
                    .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 14).frame(minHeight: 38)
                    .background(dirty ? ElmTheme.navy : ElmTheme.ink3, in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(saving || pendingAction != nil || (!dirty && !draft.isNew) || (updatesPublished && blockingCount > 0))
                .accessibilityLabel(saveTitle)
            }
        }
        .foregroundStyle(ElmTheme.ink2)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(ElmTheme.glass.background(.ultraThinMaterial))
        .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
    }

    private var saveStatus: String {
        if saving { return "جارٍ الحفظ…" }
        if let lastSavedAt { return "حُفظت \(StaffFormat.time(StaffFormat.iso(lastSavedAt)))\(dirty ? " · تعديلات غير محفوظة" : "")" }
        return dirty ? "تعديلات غير محفوظة" : "لا تعديلات"
    }

    private var statusLine: some View {
        ElmFlow(spacing: 6) {
            StatusPill(status: draft.storyStatus)
            if readOnly { Text("جاك العلم").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.gold) }
            else if draft.revisionOf != nil { Text("مسودة تعديل — النص العام لا يتغير حتى الاعتماد").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
            else if draft.storyStatus == .published { Text(capabilities.canApprove ? "«تحديث المادة» يحفظ وينشر التعديل فورًا" : "الحفظ ينشئ مسودة تعديل مستقلة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
            else if draft.storyStatus == .scheduled { Text("الحفظ ينشئ مسودة تعديل مستقلة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
            Text("\(ElmFormat.latinDigits(String(EditorMarkup.wordCount(blocks)))) كلمة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            if !readOnly { guardStatusLabel }
        }
    }

    /// حالة الحارس الحي في سطر واحد — نظير شارة الشريط على الويب.
    private var guardStatusLabel: some View {
        let allOff = !staff.governance.editorialGuard && !staff.governance.requireImageRights
        let text: String = allOff ? "فحوصات النشر الآلية معطّلة" : guardBusy ? "يفحص الحارس…" : guardReport == nil ? "تعذر فحص الحارس" : blockingCount > 0 ? "\(ElmFormat.latinDigits(String(blockingCount))) مخالفة قاطعة" : "جاهزة للاعتماد"
        let tint: Color = allOff || guardReport == nil ? ElmTheme.warn : guardBusy ? ElmTheme.ink3 : blockingCount > 0 ? ElmTheme.danger : ElmTheme.tealInk
        return Label(text, systemImage: "checkmark.shield").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(tint)
    }

    private var conflictBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("تغيّرت المادة على الخادم منذ فتحها", systemImage: "exclamationmark.triangle.fill")
                .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.danger)
            Text("تعديلاتك محفوظة على الجهاز. «تحميل نسخة الخادم» يستبدل ما هنا بنسخة زميلك، و«الاحتفاظ بنسختي» يجلب رقم النسخة الجديد ويحفظ تعديلاتك فوقها.")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            HStack {
                Button("تحميل نسخة الخادم") { Task { await reloadFromServer() } }
                Button("الاحتفاظ بنسختي") { Task { await keepMine() } }
            }
            .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
            .disabled(saving)
        }
        .padding(12)
        .background(ElmTheme.danger.opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: الحقول

    private var titleField: some View {
        TextField("عنوان المادة", text: $draft.title, axis: .vertical)
            .font(ElmFonts.display(size: 22, weight: .bold, relativeTo: .title2))
            .foregroundStyle(ElmTheme.ink)
            .lineLimit(1...4)
            .padding(14)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
            .accessibilityLabel("العنوان")
    }

    private var excerptField: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("الموجز — سطران يلخّصان المادة", text: $draft.excerpt, axis: .vertical)
                .font(ElmFonts.text(.callout))
                .lineLimit(2...6)
                .padding(12)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
                .accessibilityLabel("الموجز")
            Text("\(ElmFormat.latinDigits(String(draft.excerpt.count))) من \(ElmFormat.latinDigits(String(Self.excerptLimit))) حرفًا")
                .font(ElmFonts.text(.caption2)).foregroundStyle(draft.excerpt.count >= Self.excerptLimit ? ElmTheme.danger : ElmTheme.ink3)
        }
    }

    // MARK: المتن

    private var bodyEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("المتن — كل بلوك فقرة أو عنوان أو قائمة. التنسيق: **غامق** *مائل* [نص](رابط). في القوائم كل سطر عنصر، وسطر ينتهي بـ\\ يكمل العنصر نفسه.")
                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            ForEach(Array(blocks.enumerated()), id: \.element.id) { index, block in
                blockEditor(index: index, block: block)
            }
            Button { addBlock(after: blocks.count - 1) } label: {
                Label("إضافة فقرة", systemImage: "plus").font(ElmFonts.text(.footnote, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44)
                    .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func blockEditor(index: Int, block: EditableBlock) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Menu {
                    ForEach(EditableBlock.Kind.allCases) { kind in
                        Button { blocks[index].kind = kind } label: {
                            if kind == block.kind { Label(kind.label, systemImage: "checkmark") } else { Text(kind.label) }
                        }
                    }
                    Divider()
                    Button { blocks[index].align = block.align == "center" ? nil : "center" } label: {
                        Label(block.align == "center" ? "إلغاء التوسيط" : "توسيط", systemImage: "text.aligncenter")
                    }
                } label: {
                    Label(block.kind.label, systemImage: block.kind.symbol)
                        .font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                        .padding(.horizontal, 9).frame(minHeight: 30)
                        .background(ElmTheme.navyInk.opacity(0.08), in: Capsule())
                }
                Spacer()
                Button { wrapSelection(index: index, token: "**") } label: { Image(systemName: "bold").frame(width: 32, height: 30) }.accessibilityLabel("غامق")
                Button { insertLink(index: index) } label: { Image(systemName: "link").frame(width: 32, height: 30) }.accessibilityLabel("رابط")
                Button { moveBlock(index, by: -1) } label: { Image(systemName: "chevron.up").frame(width: 30, height: 30) }.disabled(index == 0).accessibilityLabel("تحريك لأعلى")
                Button { moveBlock(index, by: 1) } label: { Image(systemName: "chevron.down").frame(width: 30, height: 30) }.disabled(index == blocks.count - 1).accessibilityLabel("تحريك لأسفل")
                Button(role: .destructive) { removeBlock(index) } label: { Image(systemName: "trash").frame(width: 30, height: 30) }.disabled(blocks.count == 1).accessibilityLabel("حذف البلوك")
            }
            .font(.system(size: 13, weight: .medium)).foregroundStyle(ElmTheme.ink2)
            TextField(placeholder(for: block.kind), text: $blocks[index].text, axis: .vertical)
                .font(font(for: block.kind))
                .foregroundStyle(ElmTheme.ink)
                .lineLimit(1...40)
                .focused($focusedBlock, equals: block.id)
                .padding(12)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(focusedBlock == block.id ? ElmTheme.focus : ElmTheme.line2, lineWidth: focusedBlock == block.id ? 2 : 1))
                .accessibilityLabel("\(block.kind.label) \(ElmFormat.latinDigits(String(index + 1)))")
        }
    }

    private func placeholder(for kind: EditableBlock.Kind) -> String {
        switch kind {
        case .paragraph: "اكتب الفقرة…"
        case .heading2, .heading3: "عنوان فرعي"
        case .quote: "نص الاقتباس"
        case .bullets, .numbered: "عنصر في كل سطر"
        }
    }

    private func font(for kind: EditableBlock.Kind) -> Font {
        switch kind {
        case .heading2: ElmFonts.display(.title3, weight: .bold)
        case .heading3: ElmFonts.display(.headline, weight: .bold)
        default: ElmFonts.text(.body)
        }
    }

    private func addBlock(after index: Int) {
        let block = EditableBlock()
        blocks.insert(block, at: min(blocks.count, index + 1))
        focusedBlock = block.id
    }

    private func removeBlock(_ index: Int) {
        guard blocks.count > 1 else { return }
        blocks.remove(at: index)
    }

    private func moveBlock(_ index: Int, by offset: Int) {
        let target = index + offset
        guard blocks.indices.contains(target) else { return }
        blocks.swapAt(index, target)
    }

    private func wrapSelection(index: Int, token: String) {
        // بلا وصول إلى التحديد في SwiftUI: نضيف الرمزين في نهاية النص ليكتب المستخدم بينهما.
        blocks[index].text += "\(token)\(token)"
        focusedBlock = blocks[index].id
    }

    private func insertLink(index: Int) {
        blocks[index].text += "[النص](https://)"
        focusedBlock = blocks[index].id
    }

    // MARK: التفاصيل

    private var formatOptions: [(String, String)] {
        // «جاك العلم» لا يُختار أبدًا، و«فيديو» عبر مفتاح «مادة مرئية» كما على الويب.
        StaffTaxonomyPayload.editableFormats(taxonomy?.formats).filter { $0.id != "videos" }.map { ($0.id, $0.label) }
    }

    private var detailsPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            StaffCard {
                Text("التصنيف").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                pickerRow("القسم", selection: $draft.section, options: (taxonomy?.sections ?? []).map { ($0.slug, $0.label) }, fallback: ElmFormat.sectionName(draft.section))
                    .disabled(identityLocked)
                    .opacity(identityLocked ? 0.55 : 1)
                pickerRow("السلسلة", selection: Binding(get: { draft.seriesSlug ?? "" }, set: { draft.seriesSlug = $0.isEmpty ? nil : $0 }), options: [("", "بلا سلسلة")] + (taxonomy?.series ?? []).map { ($0.slug, $0.name) }, fallback: "بلا سلسلة")
                pickerRow("الشكل", selection: $draft.format, options: formatOptions, fallback: StaffTaxonomyPayload.formatLabel(draft.format))
                    .disabled(draft.format == "videos")
                    .opacity(draft.format == "videos" ? 0.55 : 1)
                if identityLocked {
                    Text("القسم والرابط ثابتان بعد النشر وفي مسودات التعديل؛ الخادم يتجاهل تغييرهما.").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                }
            }
            StaffCard {
                Text("الفيديو").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                Toggle(isOn: Binding(get: { draft.format == "videos" }, set: { draft.format = $0 ? "videos" : "news" })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("مادة مرئية").font(ElmFonts.text(.footnote, weight: .semibold))
                        Text("يعرض المشغّل أسفل عنوان المادة؛ المصدر يوتيوب أو فيديو تغريدة أو منشور إنستقرام عام.").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                    }
                }
                .tint(ElmTheme.tealInk)
                .accessibilityLabel("تفعيل فيديو للمادة")
                if draft.format == "videos" {
                    StaffField(label: "رابط الفيديو", placeholder: "رابط يوتيوب أو تغريدة X أو منشور إنستقرام", text: Binding(get: { draft.videoUrl ?? "" }, set: { draft.videoUrl = $0.isEmpty ? nil : $0 }), keyboard: .URL, ltr: true, hint: "يُحفظ الرابط بصيغته القياسية دون معلمات التتبع، وهو شرط لحفظ المادة المرئية.")
                }
            }
            StaffCard {
                Text("الصورة البارزة").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                if draft.imageURL != nil {
                    Color.clear.aspectRatio(16 / 9, contentMode: .fit).overlay { RemoteImage(url: draft.imageURL) }
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                HStack(spacing: 8) {
                    if staff.can("media.upload") {
                        StaffSecondaryButton(title: "من المكتبة أو الجهاز", symbol: "photo.on.rectangle") { mediaPicker = true }
                    }
                    if draft.image != nil {
                        StaffSecondaryButton(title: "إزالة", symbol: "xmark", destructive: true) { draft.image = nil }
                    }
                }
                StaffField(label: "رابط الصورة", placeholder: "https://", text: Binding(get: { draft.image ?? "" }, set: { draft.image = $0.isEmpty ? nil : $0 }), keyboard: .URL, ltr: true)
                if staff.governance.requireImageRights {
                    Text("بوابة النشر تشترط صورة موثّقة الحقوق من المكتبة.").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                }
            }
            StaffCard {
                Text("الكلمات المفتاحية (حتى 12)").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                if !draft.keywords.isEmpty {
                    ElmFlow(spacing: 6) {
                        ForEach(draft.keywords, id: \.self) { keyword in
                            HStack(spacing: 4) {
                                Text(keyword)
                                Button { draft.keywords.removeAll { $0 == keyword } } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)) }
                                    .accessibilityLabel("إزالة \(keyword)")
                            }
                            .font(ElmFonts.text(.caption, weight: .medium)).foregroundStyle(ElmTheme.ink)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(ElmTheme.surface2, in: Capsule())
                        }
                    }
                }
                HStack {
                    TextField("كلمة جديدة", text: $keywordInput).font(ElmFonts.text(.callout)).submitLabel(.done).onSubmit(addKeyword)
                    Button("إضافة", action: addKeyword).font(ElmFonts.text(.footnote, weight: .semibold)).disabled(keywordInput.trimmingCharacters(in: .whitespaces).isEmpty || draft.keywords.count >= 12)
                }
                .padding(10)
                .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            if capabilities.canApprove { breakingCard }
            StaffField(label: "الرابط (slug)", placeholder: "يُولَّد تلقائيًا عند تركه فارغًا", text: $draft.slug, keyboard: .asciiCapable, ltr: true, hint: identityLocked ? "ثابت بعد النشر." : nil)
                .disabled(identityLocked)
                .opacity(identityLocked ? 0.55 : 1)
        }
    }

    /// الصدارة والعاجل — رقائق «لساعتين/لست ساعات» كما على الويب، وموعد مخصص اختياري.
    private var breakingCard: some View {
        let active = draft.breakingUntil.flatMap(StaffFormat.parse).map { $0 > Date() } ?? false
        return StaffCard {
            Text("إبراز المادة").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            Toggle(isOn: $draft.pinned) { Text("تثبيت في صدارة الرئيسية").font(ElmFonts.text(.footnote)) }.tint(ElmTheme.tealInk)
            if active, let until = draft.breakingUntil {
                HStack(spacing: 10) {
                    GuardChipView(chip: StaffGuardChip(tone: "block", label: "عاجل حتى \(StaffFormat.time(until)) (الرياض)"))
                    Button("أنهِ العاجل") { draft.breakingUntil = nil; breakingCustom = false }
                        .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 36)
                }
            } else {
                HStack(spacing: 8) {
                    breakingChip("عاجل لساعتين", hours: 2)
                    breakingChip("عاجل لست ساعات", hours: 6)
                    Button { breakingCustom.toggle() } label: {
                        Label("موعد آخر", systemImage: "calendar").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 36)
                    }
                }
                if breakingCustom {
                    DatePicker("ينتهي في", selection: $breakingDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                        .font(ElmFonts.text(.footnote))
                        .riyadhPicker()
                    StaffSecondaryButton(title: "تفعيل العاجل حتى \(StaffFormat.dateTime(StaffFormat.iso(breakingDate)))", symbol: "bolt.fill") {
                        draft.breakingUntil = StaffFormat.iso(breakingDate)
                        breakingCustom = false
                    }
                }
            }
        }
    }

    private func breakingChip(_ title: String, hours: Double) -> some View {
        Button {
            draft.breakingUntil = StaffFormat.iso(Date().addingTimeInterval(hours * 3600))
            breakingCustom = false
        } label: {
            Label(title, systemImage: "bolt").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.danger)
                .padding(.horizontal, 10).frame(minHeight: 36)
                .background(ElmTheme.danger.opacity(0.08), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func pickerRow(_ label: String, selection: Binding<String>, options: [(String, String)], fallback: String) -> some View {
        HStack {
            Text(label).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
            Spacer()
            Menu {
                ForEach(options, id: \.0) { option in
                    Button { selection.wrappedValue = option.0 } label: {
                        if option.0 == selection.wrappedValue { Label(option.1, systemImage: "checkmark") } else { Text(option.1) }
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Text(options.first { $0.0 == selection.wrappedValue }?.1 ?? fallback)
                    Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold))
                }
                .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 36)
            }
            .accessibilityLabel(label)
        }
    }

    private func addKeyword() {
        let clean = keywordInput.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40)
        guard !clean.isEmpty, draft.keywords.count < 12, !draft.keywords.contains(String(clean)) else { return }
        draft.keywords.append(String(clean))
        keywordInput = ""
    }

    // MARK: SEO

    private var seoPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            StaffField(label: "عنوان البحث", placeholder: "يسقط للعنوان إن تُرك", text: $draft.seoTitle, axis: .vertical, hint: counter(draft.seoTitle.count, target: Self.seoTitleTarget))
            StaffField(label: "وصف البحث", placeholder: "يسقط للموجز إن تُرك", text: $draft.seoDescription, axis: .vertical, hint: counter(draft.seoDescription.count, target: Self.seoDescriptionTarget))
            if staff.can("ai.assist") {
                StaffSecondaryButton(title: "ولّد من المتن", symbol: "sparkles") { aiPresented = true }
            }
        }
    }

    /// «n/60» و«n/155» كما على الويب؛ الحد الفعلي للإدخال 90/200 (يقصّه الخادم أيضًا).
    private func counter(_ count: Int, target: Int) -> String {
        "\(ElmFormat.latinDigits(String(count)))/\(ElmFormat.latinDigits(String(target)))\(count > target ? " — تجاوز الطول المفضّل" : "")"
    }

    // MARK: الحارس

    private var guardPanelView: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let report = guardReport {
                let findings = report.findings ?? []
                let blocking = findings.filter { $0.severity == "blocking" }
                if findings.isEmpty {
                    Label("لا ملاحظات من الحارس التحريري", systemImage: "checkmark.shield").font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.tealInk)
                } else {
                    Text("\(ElmFormat.latinDigits(String(blocking.count))) قاطع · \(ElmFormat.latinDigits(String(findings.count - blocking.count))) تحذير/اقتراح")
                        .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(blocking.isEmpty ? ElmTheme.warn : ElmTheme.danger)
                    ForEach(findings) { finding in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(finding.message ?? finding.ruleId ?? "").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink)
                            if let excerpt = finding.excerpt, !excerpt.isEmpty { Text("«\(excerpt)»").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background((finding.severity == "blocking" ? ElmTheme.danger : ElmTheme.warn).opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            } else if guardBusy {
                ProgressView("جارٍ فحص المتن").font(ElmFonts.text(.caption))
            } else {
                StaffInlineError(message: "تعذر الاتصال بالحارس — أعد الفحص قبل الاعتماد.")
                StaffSecondaryButton(title: "أعد الفحص", symbol: "arrow.clockwise") { Task { await runGuard() } }
            }
            Text(staff.governance.editorialGuard ? "بوابة الحارس مفعّلة: المخالفة القاطعة تمنع الرفع والنشر من الخادم." : "بوابة الحارس معطّلة من الإعدادات؛ الملاحظات إرشادية.")
                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
        }
    }

    // MARK: الإجراءات

    private var gateHint: String? { blockingCount > 0 ? "البوابة مغلقة حتى تُحل المخالفات القاطعة." : nil }

    private var actionBar: some View {
        let editable = [.draft, .review].contains(draft.storyStatus) || draft.isNew
        return VStack(spacing: 10) {
            if let gateHint, editable { Text(gateHint).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.danger) }
            if draft.storyStatus == .draft || draft.isNew, capabilities.canSubmit {
                StaffPrimaryButton(title: "حفظ ورفع للاعتماد", symbol: "paperplane", busy: pendingAction == "submit", tint: ElmTheme.focus) { Task { await saveThen("submit") } }
                    .disabled(blockingCount > 0 || pendingAction != nil)
                    .opacity(blockingCount > 0 ? 0.55 : 1)
            }
            // مسودات التعديل (`revisionOf`) تُنشر أيضًا من هنا للمعتمد — النشر يدمجها في النسخة العامة.
            if capabilities.canApprove, editable {
                StaffPrimaryButton(title: "حفظ ونشر", symbol: "checkmark.seal", busy: pendingAction == "publish", tint: ElmTheme.hex("2a9a6e")) { Task { await saveThen("publish") } }
                    .disabled(blockingCount > 0 || pendingAction != nil)
                    .opacity(blockingCount > 0 ? 0.55 : 1)
            }
            if capabilities.canSchedule, editable, draft.revisionOf == nil {
                StaffSecondaryButton(title: "حفظ وجدولة", symbol: "calendar.badge.clock") { Task { await saveThen("schedule") } }
                    .disabled(blockingCount > 0 || pendingAction != nil)
                    .opacity(blockingCount > 0 ? 0.55 : 1)
            }
        }
        .padding(.top, 8)
    }

    private var scheduleSheetView: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Text("موعد النشر بتوقيت الرياض").font(ElmFonts.display(.title3, weight: .bold)).foregroundStyle(ElmTheme.ink)
                DatePicker("الموعد", selection: $scheduleDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
                    .riyadhPicker()
                    .tint(ElmTheme.navyInk)
                Text("يُنشر \(StaffFormat.dateTime(StaffFormat.iso(scheduleDate))) بتوقيت الرياض بعد تجاوز الحارس.")
                    .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                if let error { StaffInlineError(message: error.message) }
                StaffPrimaryButton(title: "تأكيد الجدولة", symbol: "calendar.badge.checkmark", busy: pendingAction == "schedule-confirm") { Task { await confirmSchedule() } }
                Spacer()
            }
            .padding(22)
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { scheduleSheet = false } } }
        }
        .presentationDetents([.large])
    }

    // MARK: المنطق

    private func bootstrap() async {
        if taxonomy == nil { taxonomy = try? await StaffAPI.taxonomy() }
        if initial == nil && !isNew {
            loading = true
            do {
                let payload = try await StaffAPI.story(id: storyId)
                apply(payload.story)
            } catch {
                self.error = staff.handle(error)
            }
            loading = false
        } else {
            apply(draft)
        }
        dirty = false
        checkRecovery()
        startHeartbeat()
        if !readOnly { await runGuard() }
        #if DEBUG
        // `-elmStaffPanel details|seo|guard` يفتح تبويبًا بعينه للقطات بلا نقر.
        let args = ProcessInfo.processInfo.arguments
        if let index = args.firstIndex(of: "-elmStaffPanel"), index + 1 < args.count {
            switch args[index + 1] {
            case "details": panel = .details
            case "seo": panel = .seo
            case "guard": panel = .guardPanel
            default: break
            }
        }
        if ElmLaunch.staffStory == storyId, !debugActionDone, !readOnly, ["edit", "keepmine"].contains(ElmLaunch.staffAction ?? "") {
            debugActionDone = true
            let keepMineFlow = ElmLaunch.staffAction == "keepmine"
            try? await Task.sleep(for: .milliseconds(800))
            draft.title = draft.title + (keepMineFlow ? " — نسختي" : " — عُدّلت من iOS")
            if !keepMineFlow {
                blocks.append(EditableBlock(kind: .paragraph, text: "فقرة أُضيفت من محرر الهاتف مع **تأكيد** و[رابط](https://alelm.net)."))
                blocks.append(EditableBlock(kind: .bullets, text: "بند أول\nبند ثانٍ"))
            }
            autosaveTask?.cancel()
            // مهلة تسمح لسكربت التحقق برفع إصدار المادة على الخادم قبل الحفظ (اختبار 409 ثم «الاحتفاظ بنسختي»).
            try? await Task.sleep(for: .milliseconds(keepMineFlow ? 4000 : 300))
            autosaveTask?.cancel()
            if updatesPublished { await updatePublished() } else { await save(autosave: false) }
            if keepMineFlow, conflict {
                try? await Task.sleep(for: .milliseconds(2500))
                await keepMine()
            }
        }
        #endif
    }

    private func apply(_ story: StaffStory) {
        draft = story
        blocks = EditorMarkup.blocks(fromHTML: story.body)
        if let until = story.breakingUntil.flatMap(StaffFormat.parse) { breakingDate = until }
        Task { @MainActor in
            await Task.yield()
            dirty = false
        }
    }

    private func markDirty() {
        guard !loading, !readOnly else { return }
        dirty = true
        persistRecovery()
        scheduleGuard()
        autosaveTask?.cancel()
        guard canAutosave, error == nil, !conflict else { return }
        autosaveTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled, dirty, !saving else { return }
            await save(autosave: true)
        }
    }

    /// فحص مؤجل 600ms بعد كل تعديل — طلب واحد حي؛ السابق يُلغى (كما `use-live-guard.ts`).
    private func scheduleGuard() {
        guardTask?.cancel()
        guardBusy = true
        guardTask = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            await runGuard()
        }
    }

    @MainActor
    private func save(autosave: Bool) async {
        guard !saving, !readOnly else { return }
        if draft.title.trimmingCharacters(in: .whitespaces).isEmpty, !autosave {
            error = .invalid("اكتب عنوانًا قبل الحفظ.")
            return
        }
        if draft.format == "videos", (draft.videoUrl ?? "").trimmingCharacters(in: .whitespaces).isEmpty, !autosave {
            error = .invalid("رابط يوتيوب أو تغريدة X أو فيديو/ريلز إنستقرام صحيح مطلوب للمادة المرئية.")
            return
        }
        saving = true
        if !autosave { error = nil; notice = nil }
        defer { saving = false }
        do {
            let result = try await StaffAPI.save(draft, expectedVersion: draft.isNew ? nil : draft.version, autosave: autosave)
            // نسخة الاسترداد محفوظة تحت المعرّف السابق؛ تُمحى قبل تبنّي معرّف مسودة التعديل الجديد.
            clearRecovery()
            adopt(result)
            dirty = false
            conflict = false
            lastSavedAt = Date()
            clearRecovery()
            if result.id != storyId, result.revisionOf != nil, draft.revisionOf != nil { notice = "حُفظت مسودة التعديل؛ النسخة المعتمدة باقية حتى النشر." }
            else if !autosave { notice = "حُفظت المادة." }
            onSaved?()
        } catch {
            let api = staff.handle(error)
            if case .conflict = api { conflict = true }
            self.error = api
        }
    }

    /// يتبنّى معرّف الرد وإصداره وهويته (القسم/الرابط كما ثبّتهما الخادم).
    private func adopt(_ result: StaffSaveResult) {
        draft.id = result.id
        draft.version = result.version
        if let slug = result.slug, !slug.isEmpty { draft.slug = slug }
        if let section = result.section, !section.isEmpty { draft.section = section }
        if let status = result.status { draft.status = status }
        draft.revisionOf = result.revisionOf ?? draft.revisionOf
    }

    /// «تحديث المادة» للمعتمد على مادة منشورة: حفظ (مسودة تعديل) ثم نشرها فورًا فتُحدَّث النسخة العامة (كما `saveManually` على الويب).
    private func updatePublished() async {
        guard pendingAction == nil else { return }
        pendingAction = "update"
        defer { pendingAction = nil }
        await save(autosave: false)
        guard error == nil, !conflict else { return }
        do {
            let result = try await StaffAPI.publish(id: draft.id, expectedVersion: draft.version)
            if let id = result.id { draft.id = id }
            draft.version = result.version ?? draft.version
            draft.status = "published"
            draft.revisionOf = nil
            dirty = false
            notice = "حُدّثت النسخة المنشورة."
            onSaved?()
        } catch {
            handleTransition(error)
        }
    }

    private func saveThen(_ action: String) async {
        guard pendingAction == nil else { return }
        pendingAction = action
        defer { pendingAction = nil }
        await save(autosave: false)
        guard error == nil, !conflict else { return }
        do {
            switch action {
            case "submit":
                let result = try await StaffAPI.submit(id: draft.id, expectedVersion: draft.version)
                draft.version = result.version ?? draft.version
                draft.status = "review"
                notice = "أُرسلت للاعتماد — بانتظار المعتمد البشري."
            case "publish":
                let result = try await StaffAPI.publish(id: draft.id, expectedVersion: draft.version)
                if let id = result.id { draft.id = id }
                draft.version = result.version ?? draft.version
                draft.status = "published"
                draft.revisionOf = nil
                notice = "نُشرت المادة على الموقع."
            case "schedule":
                scheduleSheet = true
                return
            default: break
            }
            dirty = false
            onSaved?()
        } catch {
            handleTransition(error)
        }
    }

    private func confirmSchedule() async {
        pendingAction = "schedule-confirm"
        defer { pendingAction = nil }
        do {
            let result = try await StaffAPI.schedule(id: draft.id, at: StaffFormat.iso(scheduleDate), expectedVersion: draft.version)
            draft.version = result.version ?? draft.version
            draft.status = "scheduled"
            draft.scheduledAt = StaffFormat.iso(scheduleDate)
            dirty = false
            scheduleSheet = false
            notice = "جُدولت — الحارس سيفحصها ثانية لحظة الموعد."
            onSaved?()
        } catch {
            handleTransition(error)
        }
    }

    private func handleTransition(_ error: Error) {
        let api = staff.handle(error)
        if case .guardBlocked(let text, let blocking) = api {
            self.error = .guardBlocked(([text] + blocking).filter { !$0.isEmpty }.joined(separator: "\n"), blocking: blocking)
            panel = .guardPanel
            Task { await runGuard() }
        } else if case .conflict = api {
            conflict = true
            self.error = api
        } else {
            self.error = api
        }
    }

    private func reloadFromServer() async {
        do {
            let payload = try await StaffAPI.story(id: draft.id)
            apply(payload.story)
            conflict = false
            error = nil
            clearRecovery()
            scheduleGuard()
        } catch {
            self.error = staff.handle(error)
        }
    }

    /// الاحتفاظ بتعديلاتي: جلب نسخة الخادم لأخذ رقمها ثم الحفظ فوقها بـ`expectedVersion` الجديد — قرار صريح من المستخدم.
    private func keepMine() async {
        persistRecovery()
        do {
            let payload = try await StaffAPI.story(id: draft.id)
            draft.version = payload.story.version
            draft.status = payload.story.status
            draft.revisionOf = payload.story.revisionOf
            draft.updatedAt = payload.story.updatedAt
            conflict = false
            error = nil
            await save(autosave: false)
            if error == nil { notice = "حُفظت نسختك فوق نسخة الخادم (الإصدار \(ElmFormat.latinDigits(String(draft.version))))." }
        } catch {
            self.error = staff.handle(error)
        }
    }

    private func runGuard() async {
        guardBusy = true
        defer { guardBusy = false }
        do {
            guardReport = try await StaffAPI.guardReport(title: draft.title, body: draft.body, image: draft.image, format: draft.format, breakingUntil: draft.breakingUntil)
        } catch {
            guardReport = nil
            _ = staff.handle(error)
        }
    }

    private func startHeartbeat() {
        guard !draft.isNew, heartbeatTask == nil else { return }
        let id = draft.id, session = presenceId, me = staff.actor?.userId
        heartbeatTask = Task {
            while !Task.isCancelled {
                if let editors = try? await StaffAPI.presence(id: id, sessionId: session) {
                    var seen = Set<String>()
                    coEditors = editors.filter { $0.userId != me && seen.insert($0.userId).inserted }
                }
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    private func leave() {
        autosaveTask?.cancel()
        if dirty { persistRecovery() }
        dismiss()
    }

    // MARK: نسخة الاسترداد المحلية (7 أيام)

    private var recoveryKey: String { "elm.staff.recovery.\(draft.id)" }

    private func persistRecovery() {
        guard dirty, let data = try? JSONEncoder().encode(draft) else { return }
        UserDefaults.standard.set(data, forKey: recoveryKey)
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: recoveryKey + ".at")
    }

    private func clearRecovery() {
        UserDefaults.standard.removeObject(forKey: recoveryKey)
        UserDefaults.standard.removeObject(forKey: recoveryKey + ".at")
    }

    private func checkRecovery() {
        guard let data = UserDefaults.standard.data(forKey: recoveryKey),
              let saved = try? JSONDecoder().decode(StaffStory.self, from: data) else { return }
        let at = UserDefaults.standard.double(forKey: recoveryKey + ".at")
        guard Date().timeIntervalSince1970 - at < 7 * 86_400 else { clearRecovery(); return }
        if let serverUpdated = StaffFormat.parse(draft.updatedAt), serverUpdated.timeIntervalSince1970 > at { clearRecovery(); return }
        guard saved != draft else { clearRecovery(); return }
        recovered = saved
        showRecovery = true
    }
}
