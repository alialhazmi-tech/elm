import SwiftUI

/// مساعد الذكاء في المحرر — `POST /api/tahrir/ai/assist`. لا يُطبَّق اقتراح إلا بقرار المستخدم،
/// والاقتراحات التي رفضها الحارس تُعرض معطّلة مع سبب.
struct StaffAIPanel: View {
    enum Applied {
        case title(String)
        case excerpt(String)
        case seo(title: String?, description: String?, keywords: [String]?)
        case body(String)
    }

    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    let storyId: String?
    let title: String
    let bodyText: String
    let onApply: (Applied) -> Void

    @State private var tool = "headlines"
    @State private var result: StaffAIResult?
    @State private var loading = false
    @State private var error: ElmAPIError?

    private let tools: [(String, String, String)] = [
        ("headlines", "عناوين مقترحة", "text.badge.star"),
        ("excerpt", "موجز مقترح", "text.alignright"),
        ("proofread", "تدقيق لغوي", "checkmark.circle"),
        ("improve", "تحسين الصياغة", "wand.and.stars"),
        ("seo", "SEO وكلمات مفتاحية", "magnifyingglass"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("مساعد التحرير").font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Text("الاقتراحات تمر على الحارس التحريري قبل عرضها، ولا تُطبَّق إلا بضغطك.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(tools, id: \.0) { item in
                                ElmChip(label: item.1, selected: tool == item.0) { tool = item.0; result = nil }
                            }
                        }
                    }
                    if bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && tool != "headlines" {
                        StaffInlineNotice(message: "اكتب متن المادة أولًا حتى يعمل هذا الأداة.")
                    } else {
                        StaffPrimaryButton(title: loading ? "جارٍ التوليد…" : "توليد", symbol: "sparkles", busy: loading) { Task { await run() } }
                    }
                    if let error { StaffInlineError(message: error.message) }
                    if let result { results(result) }
                }
                .padding(22)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
        }
    }

    @ViewBuilder
    private func results(_ result: StaffAIResult) -> some View {
        if let seo = result.seo {
            StaffCard {
                if let title = seo.seoTitle { Text("عنوان SEO: \(title)").font(ElmFonts.text(.footnote)) }
                if let description = seo.seoDescription { Text("الوصف: \(description)").font(ElmFonts.text(.footnote)) }
                if let keywords = seo.keywords, !keywords.isEmpty { Text("الكلمات: \(keywords.joined(separator: "، "))").font(ElmFonts.text(.footnote)) }
                StaffPrimaryButton(title: "تطبيق SEO", symbol: "checkmark") {
                    onApply(.seo(title: seo.seoTitle, description: seo.seoDescription, keywords: seo.keywords))
                    dismiss()
                }
            }
        }
        if let suggestions = result.suggestions, !suggestions.isEmpty {
            ForEach(suggestions) { suggestion in
                StaffCard {
                    Text(suggestion.display).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                    if suggestion.guardOK == false {
                        Label("رفضه الحارس — لا يمكن تطبيقه", systemImage: "hand.raised").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.danger)
                    } else {
                        Button("تطبيق") { apply(suggestion.display); dismiss() }
                            .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 40)
                    }
                }
            }
        } else if let text = result.text, !text.isEmpty {
            StaffCard {
                Text(text).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                Button("تطبيق") { apply(text); dismiss() }.font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 40)
            }
        } else if result.seo == nil {
            StaffEmptyView(title: "لا اقتراحات", detail: "جرّب أداة أخرى أو أضف تفاصيل للمتن.", symbol: "sparkles")
        }
    }

    private func apply(_ text: String) {
        switch tool {
        case "headlines": onApply(.title(text))
        case "excerpt": onApply(.excerpt(text))
        case "proofread", "improve":
            let html = text.components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                .map { "<p>\(EditorMarkup.inline($0))</p>" }.joined()
            onApply(.body(html))
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
