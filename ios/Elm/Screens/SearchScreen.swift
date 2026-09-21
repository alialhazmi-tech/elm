import SwiftUI

@MainActor
@Observable
final class SearchStore {
    var results: [StoryCard] = []
    var total = 0
    var page = 1
    var nextPage: Int?
    var loading = false
    var loadingMore = false
    /// نتائج محلية من الحزمة المحفوظة — تظهر مع رسالة الاتصال لا بديلًا عنها.
    var fromCache = false
    /// خطأ اتصال/خادم — ليس «لا نتائج».
    var errorMessage: String?
    private var query = ""

    func search(_ raw: String) async {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        query = trimmed
        guard !trimmed.isEmpty else {
            results = []
            total = 0
            page = 1
            nextPage = nil
            fromCache = false
            errorMessage = nil
            loading = false
            return
        }

        loading = true
        errorMessage = nil
        defer { loading = false }

        do {
            let payload = try await APIClient.fetchSearchPage(query: trimmed, page: 1)
            guard query == trimmed, !Task.isCancelled else { return }
            results = payload.results
            total = payload.total
            page = payload.page
            nextPage = payload.nextPage
            fromCache = false
        } catch is CancellationError {
        } catch {
            guard query == trimmed else { return }
            let api = ElmAPIError.wrap(error)
            let local = HomeCorpus.search(trimmed)
            results = local
            total = local.count
            page = 1
            nextPage = nil
            fromCache = !local.isEmpty
            errorMessage = api.isConnectivity
                ? "تعذر الاتصال بالخادم. تحقق من الشبكة وأعد المحاولة."
                : "تعذر إتمام البحث الآن. أعد المحاولة."
        }
    }

    /// الصفحة التالية (18/صفحة) — تُلحق بالنتائج بلا تكرار.
    func loadMore() async {
        guard !loadingMore, !loading, let next = nextPage else { return }
        let current = query
        loadingMore = true
        defer { loadingMore = false }
        do {
            let payload = try await APIClient.fetchSearchPage(query: current, page: next)
            guard query == current, !Task.isCancelled else { return }
            var seen = Set(results.map(\.apiId))
            results += payload.results.filter { seen.insert($0.apiId).inserted }
            total = payload.total
            page = payload.page
            nextPage = payload.nextPage
        } catch is CancellationError {
        } catch {
            guard query == current else { return }
            errorMessage = ElmAPIError.wrap(error).isConnectivity
                ? "تعذر تحميل المزيد. تحقق من الشبكة وأعد المحاولة."
                : "تعذر تحميل المزيد الآن. أعد المحاولة."
        }
    }
}

/// 1g — البحث: يتجاهل التشكيل واختلاف الهمزات، ومرشّحات بالسلاسل، وترقيم 18/صفحة كما على الويب.
struct SearchScreen: View {
    var showBack = true
    var initialQuery = ""
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var query = ""
    @State private var filter = "الكل"
    @State private var store = SearchStore()
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var fieldFocused: Bool

    /// كل السلاسل الفاعلة (لا الأربع الأولى فقط).
    private var filters: [String] { ["الكل"] + SeriesPalette.active.map(\.name) }

    private var filtered: [StoryCard] {
        guard filter != "الكل" else { return store.results }
        return store.results.filter { card in
            SeriesPalette.active.first { $0.id == card.series }?.name == filter
        }
    }

    var body: some View {
        ElmScreen(title: "البحث", showBack: showBack, showTools: false) {
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
        .onAppear {
            if query.isEmpty { query = initialQuery }
            fieldFocused = initialQuery.isEmpty
        }
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
                    // الاقتراحات نفسها كما على `/search`.
                    ForEach(["التنجستن", "غينيس", "الرياض"], id: \.self) { item in
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
        } else {
            if let error = store.errorMessage {
                // الخطأ خطأ — لا يُقدَّم أبدًا كـ«لا نتائج».
                VStack(alignment: .leading, spacing: 10) {
                    Label(error, systemImage: "wifi.slash")
                        .font(ElmFonts.text(.footnote, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                    Button("إعادة المحاولة") { Task { await store.search(query) } }
                        .font(ElmFonts.text(.footnote, weight: .semibold))
                        .foregroundStyle(ElmTheme.navyInk)
                        .frame(minHeight: 44)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.bottom, 8)
            }
            if store.errorMessage == nil, store.total == 0 {
                Text("لا نتائج مطابقة. جرّب كلمة أعم أو تصفّح السلاسل.")
                    .font(ElmFonts.text(.callout))
                    .foregroundStyle(ElmTheme.ink2)
                    .padding(.top, 8)
            } else if filtered.isEmpty, !store.results.isEmpty {
                Text("لا نتائج ضمن هذا المرشّح.")
                    .font(ElmFonts.text(.callout))
                    .foregroundStyle(ElmTheme.ink2)
                    .padding(.top, 8)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(filtered) { story in
                        NavigationLink {
                            StoryDestination(seed: story)
                        } label: {
                            resultRow(story)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(kicker(story))، \(story.title)")
                        Divider().overlay(ElmTheme.line)
                    }
                }
                if store.loadingMore {
                    ProgressView().tint(ElmTheme.navy).frame(maxWidth: .infinity).padding(16)
                } else if store.nextPage != nil, filter == "الكل" {
                    Button("عرض المزيد") { Task { await store.loadMore() } }
                        .font(ElmFonts.text(.body, weight: .semibold))
                        .foregroundStyle(ElmTheme.ink)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(ElmTheme.surface2, in: Capsule())
                        .padding(.top, 14)
                        .accessibilityHint("الصفحة \(ElmFormat.latinDigits(String(store.page + 1))) من النتائج")
                }
            }
        }
    }

    /// صف النتيجة: كيكر وعنوان وموجز، ومصغّرة كبطاقة الفسيفساء على الويب.
    private func resultRow(_ story: StoryCard) -> some View {
        HStack(alignment: .top, spacing: 12) {
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
            if story.imageURL != nil, !typeSize.isAccessibilitySize {
                RemoteImage(url: story.imageURL, height: 69, maxPixel: 320)
                    .frame(width: 92)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusUI, style: .continuous))
            }
        }
        .padding(.vertical, 13)
        .contentShape(Rectangle())
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
        if store.loading && store.results.isEmpty { return "جارٍ البحث…" }
        if store.errorMessage != nil {
            return store.fromCache
                ? "نتائج محلية من الحزمة المحفوظة (\(ElmFormat.latinDigits(String(store.results.count))))"
                : "تعذر الاتصال — لا نتائج محلية لهذه الكلمة"
        }
        let total = ElmFormat.latinDigits(String(store.total))
        let shown = ElmFormat.latinDigits(String(store.results.count))
        if store.total > store.results.count {
            return "\(total) نتيجة · عرض 1–\(shown) · يتجاهل التشكيل واختلاف الهمزات"
        }
        return "\(total) نتيجة — البحث يتجاهل التشكيل واختلاف الهمزات"
    }
}
