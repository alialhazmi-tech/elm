import SwiftUI

private struct SearchSuggestion: Identifiable {
    var id: String { query }
    let label: String
    let query: String
}

private let suggestedQueries: [SearchSuggestion] = [
    .init(label: "أسعار التنجستن", query: "التنجستن"),
    .init(label: "أرقام غينيس القياسية", query: "غينيس"),
    .init(label: "أحداث الرياض", query: "الرياض"),
]

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

/// 1e — البحث العربي مع تطبيع الهمزات والتشكيل و«الـ».
struct SearchScreen: View {
    @State private var query = ""
    @State private var store = SearchStore()
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("اسأل العلم")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.ink2)
                    Text(query.isEmpty ? "ابحث في العلم" : "نتائج «\(query)»")
                        .font(ElmFonts.display(.title, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text(statusLine)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink2)
                }

                searchField

                content
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("بحث")
        .navigationBarTitleDisplayMode(.large)
        .onChange(of: query) { _, newValue in
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(for: .milliseconds(300))
                guard !Task.isCancelled else { return }
                await store.search(newValue)
            }
        }
        .onSubmit(of: .text) {
            searchTask?.cancel()
            Task { await store.search(query) }
        }
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(ElmTheme.ink2)
                .accessibilityHidden(true)
            TextField("لماذا ترتفع أسعار التنجستن؟", text: $query)
                .font(ElmFonts.text(.body))
                .foregroundStyle(ElmTheme.ink)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
        }
        .padding(14)
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                .stroke(ElmTheme.line, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("ابحث في العلم")
    }

    @ViewBuilder
    private var content: some View {
        if trimmedQuery.isEmpty {
            queryChips
        } else if store.loading && store.results.isEmpty {
            ProgressView()
                .tint(ElmTheme.navy)
                .frame(maxWidth: .infinity)
                .padding(.top, 24)
        } else if store.results.isEmpty {
            Text(store.errorMessage ?? "لا نتائج مطابقة. جرّب كلمة أعم أو تصفّح السلاسل.")
                .font(ElmFonts.text(.body))
                .foregroundStyle(ElmTheme.ink2)
                .padding(.top, 8)
        } else {
            ForEach(store.results) { story in
                MosaicStoryCard(story: story)
            }
        }
    }

    private var queryChips: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("جرّب")
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(ElmTheme.ink2)
            ForEach(suggestedQueries) { item in
                Button {
                    query = item.query
                } label: {
                    Text(item.label)
                        .font(ElmFonts.text(.subheadline, weight: .semibold))
                        .foregroundStyle(ElmTheme.navy)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(ElmTheme.surface2)
                        .clipShape(Capsule())
                }
                .accessibilityLabel("ابحث عن \(item.label)")
            }
        }
    }

    private var statusLine: String {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return "اكتب سؤالك أو كلمتك — البحث يتجاهل التشكيل واختلاف الهمزات و«الـ»."
        }
        if store.fromCache {
            return "\(ElmFormat.latinDigits(String(store.total))) نتيجة من الكاش المحلي"
        }
        if store.total > 0 {
            return "\(ElmFormat.latinDigits(String(store.total))) نتيجة"
        }
        return "البحث يتجاهل التشكيل واختلاف الهمزات"
    }
}
