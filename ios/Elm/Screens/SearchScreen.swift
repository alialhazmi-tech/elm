import SwiftUI

@MainActor
@Observable
final class SearchStore {
    var results: [StoryCard] = []
    var total = 0
    var loading = false
    var fromCache = false
    var errorMessage: String?

    func search(_ raw: String) async {
        let query = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            results = []
            total = 0
            fromCache = false
            errorMessage = nil
            loading = false
            return
        }

        loading = true
        errorMessage = nil
        defer { loading = false }

        do {
            let payload = try await APIClient.fetchSearch(query: query)
            results = payload.results
            total = payload.total
            fromCache = false
        } catch {
            let local = HomeCorpus.search(query)
            results = local
            total = local.count
            fromCache = !local.isEmpty
            if local.isEmpty {
                errorMessage = "لا نتائج مطابقة. جرّب كلمة أعم أو تصفّح السلاسل."
            }
        }
    }
}

/// 1g — البحث: يتجاهل التشكيل واختلاف الهمزات، ومرشّحات بالسلاسل.
struct SearchScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var filter = "الكل"
    @State private var store = SearchStore()
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var fieldFocused: Bool

    private var filters: [String] { ["الكل"] + SeriesPalette.active.prefix(4).map(\.name) }

    private var filtered: [StoryCard] {
        guard filter != "الكل" else { return store.results }
        return store.results.filter { card in
            SeriesPalette.active.first { $0.id == card.series }?.name == filter
        }
    }

    var body: some View {
        ElmScreen(title: "البحث", showBack: true) {
            VStack(alignment: .leading, spacing: 0) {
                field

                Text(statusLine)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .padding(.top, 10)

                if !store.results.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(filters, id: \.self) { item in
                                ElmChip(label: item, selected: filter == item) { filter = item }
                            }
                        }
                        .padding(.vertical, 3)
                    }
                    .scrollClipDisabled()
                    .padding(.top, 12)
                }

                content.padding(.top, 14)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
        }
        .onAppear { fieldFocused = true }
        .onChange(of: query) { _, newValue in
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(for: .milliseconds(300))
                guard !Task.isCancelled else { return }
                await store.search(newValue)
            }
        }
    }

    private var field: some View {
        HStack(spacing: 9) {
            Text("✦").foregroundStyle(SeriesPalette.color(for: "shakhsiat"))
            TextField("ابحث في مواد العلم", text: $query)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($fieldFocused)
                .onSubmit {
                    searchTask?.cancel()
                    Task { await store.search(query) }
                }
            Rectangle().fill(ElmTheme.line2).frame(width: 1, height: 16)
            Button(query.isEmpty ? "إلغاء" : "مسح") {
                if query.isEmpty { dismiss() } else { query = "" }
            }
            .font(ElmFonts.text(.caption2))
            .foregroundStyle(ElmTheme.ink3)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [ElmTheme.teal, ElmTheme.focus, SeriesPalette.color(for: "shakhsiat")],
                        startPoint: .trailing,
                        endPoint: .leading
                    ),
                    lineWidth: 1.5
                )
        )
    }

    @ViewBuilder
    private var content: some View {
        if query.trimmingCharacters(in: .whitespaces).isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("جرّب")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.ink3)
                ElmFlow(spacing: 7) {
                    ForEach(["مضيق هرمز", "غينيس", "الرياض", "الجاذبية"], id: \.self) { item in
                        Button { query = item } label: {
                            Text(item)
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(ElmTheme.ink2)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(ElmTheme.surface, in: Capsule())
                                .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        } else if store.loading && store.results.isEmpty {
            ProgressView().tint(ElmTheme.navy).frame(maxWidth: .infinity).padding(.top, 24)
        } else if filtered.isEmpty {
            Text(store.errorMessage ?? "لا نتائج ضمن هذا المرشّح.")
                .font(ElmFonts.text(.callout))
                .foregroundStyle(ElmTheme.ink2)
                .padding(.top, 8)
        } else {
            LazyVStack(spacing: 0) {
                ForEach(filtered) { story in
                    NavigationLink {
                        StoryDestination(seed: story)
                    } label: {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(kicker(story))
                                .font(ElmFonts.text(.caption2, weight: .bold))
                                .foregroundStyle(story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent)
                            Text(story.title)
                                .font(ElmFonts.display(.subheadline, weight: .bold))
                                .foregroundStyle(ElmTheme.ink)
                                .multilineTextAlignment(.leading)
                                .padding(.top, 4)
                            if !story.excerpt.isEmpty {
                                Text(story.excerpt)
                                    .font(ElmFonts.text(.caption))
                                    .foregroundStyle(ElmTheme.ink3)
                                    .multilineTextAlignment(.leading)
                                    .lineLimit(2)
                                    .lineSpacing(3)
                                    .padding(.top, 5)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(ElmTheme.line)
                }
            }
        }
    }

    private func kicker(_ story: StoryCard) -> String {
        let series = story.series.flatMap { slug in SeriesPalette.active.first { $0.id == slug }?.name }
        let section = ElmFormat.sectionName(story.section)
        if let series { return "\(series) · \(section)" }
        return story.eyebrow.isEmpty ? section : story.eyebrow
    }

    private var statusLine: String {
        if query.trimmingCharacters(in: .whitespaces).isEmpty {
            return "اكتب كلمتك — البحث يتجاهل التشكيل واختلاف الهمزات و«الـ»."
        }
        let count = ElmFormat.latinDigits(String(filtered.count))
        let source = store.fromCache ? " من الحزمة المحفوظة" : ""
        return "\(count) نتائج\(source) · يتجاهل التشكيل واختلاف الهمزات"
    }
}
