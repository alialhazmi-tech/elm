import SwiftUI

/// مساعد الذكاء في المحرر — `POST /api/tahrir/ai/assist`. لا يُطبَّق اقتراح إلا بقرار المستخدم،
/// والاقتراحات التي رفضها الحارس تُعرض معطّلة مع سبب. نص المتن يُرسل خامًا (بلا ترميز ولا استبدال أرقام)،
/// ونتيجة التدقيق/التحسين تعود نصًا خالصًا يطبّقه المحرر فقرةً بفقرة على بلوكات الفقرات فقط.
struct StaffAIPanel: View {
    enum Applied {
        case title(String)
        case excerpt(String)
        case seo(title: String?, description: String?, keywords: [String]?)
        /// نص خالص بفقرات مفصولة بسطر فارغ — المحرر يحافظ على العناوين والقوائم والاقتباسات.
        case bodyText(String)
        case classify(seriesSlug: String?, section: String?, format: String?)
    }

    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    let storyId: String?
    let title: String
    let bodyText: String
    var taxonomy: StaffTaxonomyPayload? = nil
    let onApply: (Applied) -> Void

    @State private var tool = "headlines"
    @State private var result: StaffAIResult?
    @State private var loading = false
    @State private var error: ElmAPIError?

    static let seoGuardMessage = "لم يجتز الحارس؛ لا يمكن تطبيق الحزمة."

    private let tools: [(String, String, String)] = [
        ("headlines", "اقترح عناوين", "text.badge.star"),
        ("excerpt", "ولّد قبل القراءة", "text.alignright"),
        ("improve", "حسّن الصياغة", "wand.and.stars"),
        ("proofread", "دقق لغويًا", "checkmark.circle"),
        ("classify", "صنّف المادة", "tag"),
        ("seo", "SEO وكلمات مفتاحية", "magnifyingglass"),
    ]

    private var bodyEmpty: Bool { bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("محرر العلم — المساعد الذكي").font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Text(staff.governance.editorialGuard ? "الاقتراحات تمر على الحارس التحريري قبل عرضها، ولا تُطبَّق إلا بضغطك." : "فحص الحارس معطّل من إعدادات النظام؛ الاقتراحات تُعرض كما هي ولا تُطبَّق إلا بضغطك.")
                        .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(tools, id: \.0) { item in
                                ElmChip(label: item.1, selected: tool == item.0) { tool = item.0; result = nil; error = nil }
                            }
                        }
                    }
                    // الخادم يشترط متنًا لكل الأدوات — ومنها العناوين (`assist/route.ts`).
                    if bodyEmpty {
                        StaffInlineNotice(message: "أضف متن المادة أولًا حتى تعمل هذه الأداة.", symbol: "text.insert")
                    } else {
                        StaffPrimaryButton(title: loading ? "جارٍ التوليد…" : "توليد", symbol: "sparkles", busy: loading) { Task { await run() } }
                    }
                    if let error { StaffInlineError(message: error.message, retry: bodyEmpty ? nil : { Task { await run() } }) }
                    if let result { results(result) }
                    Text("التوليد الشامل ومولّد البيانات الوصفية متاحان من لوحة الويب فقط. الحوكمة: الدستور يُحقن في كل استدعاء، وكل مخرج يمر على الحارس، والإدراج بنقرة منك ويُدوَّن — لا ينشر الذكاء شيئًا.")
                        .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).padding(.top, 6)
                }
                .padding(22)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
        }
    }

    @ViewBuilder
    private func results(_ result: StaffAIResult) -> some View {
        if let seo = result.seo { seoCard(seo) }
        if let classify = result.classify { classifyCard(classify) }
        if let suggestions = result.suggestions, !suggestions.isEmpty {
            ForEach(suggestions) { suggestion in
                StaffCard {
                    Text(suggestion.display).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                    if suggestion.guardOK == false {
                        Label("رفضه الحارس — لا يمكن تطبيقه", systemImage: "hand.raised").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.danger)
                    } else {
                        if tool == "proofread" || tool == "improve" {
                            Text("يُطبَّق على فقرات المتن بالترتيب؛ العناوين والقوائم والاقتباسات والتغريدات تبقى في مواضعها.")
                                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                        }
                        Button(applyTitle) { apply(suggestion.display); dismiss() }
                            .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 40)
                    }
                }
            }
        } else if let text = result.text, !text.isEmpty {
            StaffCard {
                Text(text).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                Button(applyTitle) { apply(text); dismiss() }.font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 40)
            }
        } else if result.seo == nil, result.classify == nil {
            StaffEmptyView(title: "لا اقتراحات", detail: "جرّب أداة أخرى أو أضف تفاصيل للمتن.", symbol: "sparkles")
        }
    }

    private var applyTitle: String {
        switch tool {
        case "improve": "اعتمد التحسين"
        case "proofread": "اعتمد التدقيق"
        default: "أدرج"
        }
    }

    private func seoCard(_ seo: StaffAIResult.SEO) -> some View {
        StaffCard {
            Text("حزمة SEO المقترحة").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            if let title = seo.seoTitle { Text("عنوان البحث: \(title)").font(ElmFonts.text(.footnote)) }
            if let description = seo.seoDescription { Text("وصف البحث: \(description)").font(ElmFonts.text(.footnote)) }
            if let keywords = seo.keywords, !keywords.isEmpty { Text("الكلمات: \(keywords.joined(separator: "، "))").font(ElmFonts.text(.footnote)) }
            ForEach(seo.guardMessages, id: \.self) { message in Text(message).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
            if seo.guardOK == true {
                GuardChipView(chip: StaffGuardChip(tone: "ok", label: seo.guardMessages.isEmpty ? "مرّ على الحارس" : "\(ElmFormat.latinDigits(String(seo.guardMessages.count))) ملاحظة"))
                StaffPrimaryButton(title: "اعتماد SEO", symbol: "checkmark") {
                    onApply(.seo(title: seo.seoTitle, description: seo.seoDescription, keywords: seo.keywords))
                    dismiss()
                }
            } else {
                // كما `seo-panel.tsx`: لا تُعتمد الحزمة إلا إن كان `guard.ok === true`.
                Label(Self.seoGuardMessage, systemImage: "hand.raised").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.danger)
            }
        }
    }

    private func classifyCard(_ classify: StaffAIResult.Classify) -> some View {
        let seriesName = classify.seriesSlug.flatMap { slug in taxonomy?.series.first { $0.slug == slug }?.name ?? slug } ?? "بلا سلسلة"
        let sectionName = classify.section.map { slug in taxonomy?.sections.first { $0.slug == slug }?.label ?? ElmFormat.sectionName(slug) } ?? "—"
        let formatName = classify.format.map { StaffTaxonomyPayload.formatLabel($0) } ?? "—"
        return StaffCard {
            Text("التصنيف المقترح").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
            ElmFlow(spacing: 6) {
                chip(seriesName)
                chip(sectionName)
                chip(formatName)
            }
            if classify.format == "jakalelm" {
                Text("شكل «جاك العلم» لا يُطبَّق من التطبيق؛ سيُطبَّق القسم والسلسلة فقط.").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            StaffPrimaryButton(title: "طبّق", symbol: "checkmark") {
                onApply(.classify(seriesSlug: classify.seriesSlug, section: classify.section, format: classify.format))
                dismiss()
            }
        }
    }

    private func chip(_ text: String) -> some View {
        Text(text).font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.ink)
            .padding(.horizontal, 10).padding(.vertical, 6).background(ElmTheme.surface2, in: Capsule())
    }

    private func apply(_ text: String) {
        switch tool {
        case "headlines": onApply(.title(text))
        case "excerpt": onApply(.excerpt(text))
        case "proofread", "improve": onApply(.bodyText(text))
        default: break
        }
    }

    private func run() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            result = try await StaffAPI.assist(tool: tool, storyId: storyId, title: title, body: bodyText)
        } catch {
            self.error = staff.handle(error)
        }
    }
}
