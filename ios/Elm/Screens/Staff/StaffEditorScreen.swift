import SwiftUI
import PhotosUI

/// محرر المادة على الجوال — نظير `components/tahrir/editor`: العنوان والموجز والمتن ببلوكات،
/// التفاصيل (القسم/السلسلة/الشكل/الصورة/الفيديو/الكلمات/SEO/التثبيت/العاجل)، الحارس الحي،
/// مساعد الذكاء، حفظ تلقائي كل ثانيتين للمسودات، نسخة استرداد محلية، وقفل الإصدار مع 409 صريح.
struct StaffEditorScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
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
    @State private var keywordInput = ""
    @State private var mediaPicker = false
    @State private var showRecovery = false
    @State private var recovered: StaffStory?
    @State private var aiPresented = false
    @State private var panel: Panel = .body
    @State private var breakingEnabled = false
    @State private var breakingDate = Date().addingTimeInterval(3 * 3600)
    @State private var presenceId = UUID().uuidString
    @State private var coEditors: [StaffEditor] = []
    @State private var pendingAction: String?
    @State private var debugActionDone = false
    @FocusState private var focusedBlock: UUID?

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

    private var canAutosave: Bool { draft.storyStatus == .draft || draft.isNew }
    private var capabilities: StaffCapabilities { StaffCapabilities(actor: staff.actor ?? placeholderActor, story: draft.isNew ? nil : draft) }
    private var placeholderActor: StaffActor { try! JSONDecoder().decode(StaffActor.self, from: Data(#"{"userId":"","permissions":[]}"#.utf8)) }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if loading { ProgressView("جارٍ تحميل المادة").frame(maxWidth: .infinity).padding(20) }
                    statusLine
                    if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                    if let error { StaffInlineError(message: error.message) }
                    if conflict { conflictBanner }
                    if !coEditors.isEmpty {
                        StaffInlineNotice(message: "يحرر الآن: \(coEditors.map(\.name).joined(separator: "، ")) — قفل الإصدار يحميكم من التعارض.", symbol: "person.2")
                    }
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
                    actionBar
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
            if dirty { persistRecovery() }
            Task { try? await StaffAPI.presence(id: draft.id, sessionId: presenceId, leave: true) }
        }
        .onChange(of: draft) { old, new in if old.contentSignature != new.contentSignature { markDirty() } }
        .onChange(of: blocks) { _, _ in
            draft.body = EditorMarkup.html(from: blocks)
        }
        .sheet(isPresented: $mediaPicker) {
            StaffMediaPickerSheet { url in draft.image = url }.elmRTL()
        }
        .sheet(isPresented: $aiPresented) {
            StaffAIPanel(storyId: draft.isNew ? nil : draft.id, title: draft.title, bodyText: ArticleBlocks.paragraphs(ArticleBlocks.parse(html: draft.body)).joined(separator: "\n\n")) { result in
                switch result {
                case .title(let text): draft.title = text
                case .excerpt(let text): draft.excerpt = text
                case .seo(let title, let description, let keywords):
                    if let title { draft.seoTitle = title }
                    if let description { draft.seoDescription = description }
                    if let keywords, !keywords.isEmpty { draft.keywords = Array(keywords.prefix(12)) }
                case .body(let html):
                    blocks = EditorMarkup.blocks(fromHTML: html)
                }
            }.elmRTL()
        }
        .alert("نسخة محلية أحدث", isPresented: $showRecovery) {
            Button("استعادة نسختي") { if let recovered { apply(recovered) }; clearRecovery() }
            Button("تجاهلها", role: .cancel) { clearRecovery() }
        } message: { Text("وُجدت تعديلات لم تُحفظ على هذا الجهاز منذ آخر جلسة. هل تريد استعادتها؟") }
    }

    // MARK: الشريط العلوي

    private var toolbar: some View {
        HStack(spacing: 8) {
            Button { leave() } label: {
                Image(systemName: "arrow.right").font(.system(size: 15, weight: .semibold)).frame(width: 44, height: 44)
            }.accessibilityLabel("رجوع")
            VStack(alignment: .leading, spacing: 1) {
                Text(draft.isNew ? "مادة جديدة" : "تحرير المادة").font(ElmFonts.text(.subheadline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                Text(saveStatus).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            Spacer()
            if staff.can("ai.assist") {
                Button { aiPresented = true } label: {
                    Image(systemName: "sparkles").font(.system(size: 17)).frame(width: 44, height: 44)
                }.accessibilityLabel("مساعد الذكاء")
            }
            Button { Task { await save(autosave: false) } } label: {
                HStack(spacing: 6) {
                    if saving { ProgressView().tint(.white) } else { Image(systemName: "checkmark") }
                    Text("حفظ")
                }
                .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(.white)
                .padding(.horizontal, 14).frame(minHeight: 38)
                .background(dirty ? ElmTheme.navy : ElmTheme.ink3, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(saving || (!dirty && !draft.isNew))
            .accessibilityLabel("حفظ المادة")
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
            if draft.revisionOf != nil { Text("مسودة تعديل — النص العام لا يتغير حتى الاعتماد").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
            else if [.published, .scheduled].contains(draft.storyStatus) { Text("الحفظ ينشئ مسودة تعديل مستقلة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
            Text("\(ElmFormat.latinDigits(String(EditorMarkup.wordCount(blocks)))) كلمة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
        }
    }

    private var conflictBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("تغيّرت المادة على الخادم منذ فتحها", systemImage: "exclamationmark.triangle.fill")
                .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.danger)
            Text("تعديلاتك محفوظة على الجهاز. يمكنك تحميل نسخة الخادم (وتفقد تعديلاتك هنا) أو الحفظ فوقها بعد المراجعة.")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            HStack {
                Button("تحميل نسخة الخادم") { Task { await reloadFromServer() } }
                Button("الحفظ فوقها") { Task { await save(autosave: false, force: true) } }
            }
            .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
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
            Text("\(ElmFormat.latinDigits(String(draft.excerpt.count))) حرفًا").font(ElmFonts.text(.caption2)).foregroundStyle(draft.excerpt.count > 280 ? ElmTheme.danger : ElmTheme.ink3)
        }
    }

    // MARK: المتن

    private var bodyEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("المتن — كل بلوك فقرة أو عنوان أو قائمة. التنسيق: **غامق** *مائل* [نص](رابط)")
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

    private var detailsPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            StaffCard {
                Text("التصنيف").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                pickerRow("القسم", selection: $draft.section, options: (taxonomy?.sections ?? []).map { ($0.slug, $0.label) }, fallback: ElmFormat.sectionName(draft.section))
                pickerRow("السلسلة", selection: Binding(get: { draft.seriesSlug ?? "" }, set: { draft.seriesSlug = $0.isEmpty ? nil : $0 }), options: [("", "بلا سلسلة")] + (taxonomy?.series ?? []).map { ($0.slug, $0.name) }, fallback: "بلا سلسلة")
                pickerRow("الشكل", selection: $draft.format, options: (taxonomy?.formats ?? StaffTaxonomyPayload.defaultFormats).map { ($0.id, $0.label) }, fallback: draft.format)
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
                StaffField(label: "رابط الفيديو (يوتيوب أو X أو إنستقرام)", placeholder: "https://www.youtube.com/watch?v=…", text: Binding(get: { draft.videoUrl ?? "" }, set: { draft.videoUrl = $0.isEmpty ? nil : $0 }), keyboard: .URL, ltr: true, hint: "يُعرض مشغّلًا مضمّنًا لمواد شكل «فيديو».")
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
            if capabilities.canApprove {
                StaffCard {
                    Text("الصدارة والعاجل").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                    Toggle(isOn: $draft.pinned) { Text("تثبيت في صدارة الرئيسية").font(ElmFonts.text(.footnote)) }.tint(ElmTheme.tealInk)
                    Toggle(isOn: $breakingEnabled) { Text("عاجل حتى موعد").font(ElmFonts.text(.footnote)) }.tint(ElmTheme.danger)
                        .onChange(of: breakingEnabled) { _, on in draft.breakingUntil = on ? StaffFormat.iso(breakingDate) : nil }
                    if breakingEnabled {
                        DatePicker("ينتهي في", selection: $breakingDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                            .font(ElmFonts.text(.footnote))
                            .environment(\.timeZone, TimeZone(identifier: "Asia/Riyadh")!)
                            .onChange(of: breakingDate) { _, date in draft.breakingUntil = StaffFormat.iso(date) }
                    }
                }
            }
            StaffField(label: "الرابط (slug)", placeholder: "يُولَّد تلقائيًا عند تركه فارغًا", text: $draft.slug, keyboard: .asciiCapable, ltr: true)
        }
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
            StaffField(label: "عنوان SEO", placeholder: "يسقط للعنوان عند تركه", text: $draft.seoTitle, axis: .vertical, hint: "\(ElmFormat.latinDigits(String(draft.seoTitle.count)))/70")
            StaffField(label: "وصف SEO", placeholder: "يسقط للموجز عند تركه", text: $draft.seoDescription, axis: .vertical, hint: "\(ElmFormat.latinDigits(String(draft.seoDescription.count)))/160")
            if staff.can("ai.assist") {
                StaffSecondaryButton(title: "اقتراح SEO بالذكاء", symbol: "sparkles") { aiPresented = true }
            }
        }
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
                        .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(blocking.isEmpty ? ElmTheme.hex("b8760a") : ElmTheme.danger)
                    ForEach(findings) { finding in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(finding.message ?? finding.ruleId ?? "").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink)
                            if let excerpt = finding.excerpt, !excerpt.isEmpty { Text("«\(excerpt)»").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background((finding.severity == "blocking" ? ElmTheme.danger : ElmTheme.hex("b8760a")).opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            } else {
                ProgressView("جارٍ فحص المتن").font(ElmFonts.text(.caption))
            }
            Text(staff.governance.editorialGuard ? "بوابة الحارس مفعّلة: المخالفة القاطعة تمنع الرفع والنشر من الخادم." : "بوابة الحارس معطّلة من الإعدادات؛ الملاحظات إرشادية.")
                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
        }
        .task(id: panel) { if panel == .guardPanel { await runGuard() } }
    }

    // MARK: الإجراءات

    private var actionBar: some View {
        VStack(spacing: 10) {
            if draft.storyStatus == .draft || draft.isNew, capabilities.canSubmit {
                StaffPrimaryButton(title: "حفظ ورفع للاعتماد", symbol: "paperplane", busy: pendingAction == "submit", tint: ElmTheme.focus) { Task { await saveThen("submit") } }
            }
            if capabilities.canApprove, draft.revisionOf == nil, [.draft, .review].contains(draft.storyStatus) || draft.isNew {
                StaffPrimaryButton(title: "حفظ ونشر", symbol: "checkmark.seal", busy: pendingAction == "publish", tint: ElmTheme.hex("2a9a6e")) { Task { await saveThen("publish") } }
            }
        }
        .padding(.top, 8)
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
        Task { await heartbeat() }
        #if DEBUG
        if ElmLaunch.staffAction == "edit", ElmLaunch.staffStory == storyId, !debugActionDone {
            debugActionDone = true
            try? await Task.sleep(for: .milliseconds(800))
            draft.title = draft.title + " — عُدّلت من iOS"
            blocks.append(EditableBlock(kind: .paragraph, text: "فقرة أُضيفت من محرر الهاتف مع **تأكيد** و[رابط](https://alelm.net)."))
            blocks.append(EditableBlock(kind: .bullets, text: "بند أول\nبند ثانٍ"))
            try? await Task.sleep(for: .milliseconds(300))
            await save(autosave: false)
        }
        #endif
    }

    private func apply(_ story: StaffStory) {
        draft = story
        blocks = EditorMarkup.blocks(fromHTML: story.body)
        breakingEnabled = story.breakingUntil.flatMap(StaffFormat.parse).map { $0 > Date() } ?? false
        if let until = story.breakingUntil.flatMap(StaffFormat.parse) { breakingDate = until }
        Task { @MainActor in
            await Task.yield()
            dirty = false
        }
    }

    private func markDirty() {
        guard !loading else { return }
        dirty = true
        persistRecovery()
        autosaveTask?.cancel()
        guard canAutosave, error == nil, !conflict else { return }
        autosaveTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled, dirty, !saving else { return }
            await save(autosave: true)
        }
        if panel == .guardPanel {
            guardTask?.cancel()
            guardTask = Task {
                try? await Task.sleep(for: .milliseconds(800))
                guard !Task.isCancelled else { return }
                await runGuard()
            }
        }
    }

    @MainActor
    private func save(autosave: Bool, force: Bool = false) async {
        guard !saving else { return }
        if draft.title.trimmingCharacters(in: .whitespaces).isEmpty, !autosave {
            error = .invalid("اكتب عنوانًا قبل الحفظ.")
            return
        }
        saving = true
        if !autosave { error = nil; notice = nil }
        defer { saving = false }
        do {
            let result = try await StaffAPI.save(draft, expectedVersion: force ? nil : (draft.isNew ? nil : draft.version), autosave: autosave)
            let switched = result.id != draft.id
            draft.id = result.id
            draft.version = result.version
            if let slug = result.slug { draft.slug = slug }
            if let status = result.status { draft.status = status }
            draft.revisionOf = result.revisionOf ?? draft.revisionOf
            dirty = false
            conflict = false
            lastSavedAt = Date()
            clearRecovery()
            if switched { notice = "أُنشئت مسودة تعديل مستقلة عن النسخة المنشورة؛ ستُدمج عند الاعتماد." }
            else if !autosave { notice = "حُفظت المادة." }
            onSaved?()
        } catch {
            let api = staff.handle(error)
            if case .conflict = api { conflict = true }
            self.error = api
        }
    }

    private func saveThen(_ action: String) async {
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
                notice = "رُفعت المادة للاعتماد."
            case "publish":
                let result = try await StaffAPI.publish(id: draft.id, expectedVersion: draft.version)
                draft.version = result.version ?? draft.version
                draft.status = "published"
                notice = "نُشرت المادة."
            default: break
            }
            dirty = false
            onSaved?()
        } catch {
            let api = staff.handle(error)
            if case .guardBlocked(let text, let blocking) = api {
                self.error = .guardBlocked(([text] + blocking).filter { !$0.isEmpty }.joined(separator: "\n"), blocking: blocking)
                panel = .guardPanel
            } else {
                self.error = api
            }
        }
    }

    private func reloadFromServer() async {
        do {
            let payload = try await StaffAPI.story(id: draft.id)
            apply(payload.story)
            conflict = false
            error = nil
            clearRecovery()
        } catch {
            self.error = staff.handle(error)
        }
    }

    private func runGuard() async {
        do {
            guardReport = try await StaffAPI.guardReport(title: draft.title, body: draft.body, image: draft.image, format: draft.format, breakingUntil: draft.breakingUntil)
        } catch {
            _ = staff.handle(error)
        }
    }

    private func heartbeat() async {
        guard !draft.isNew else { return }
        while !Task.isCancelled {
            if let data = try? await StaffAPI.presence(id: draft.id, sessionId: presenceId) as Void? { _ = data }
            try? await Task.sleep(for: .seconds(30))
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
