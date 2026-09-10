import SwiftUI

/// المواد — نظير `/tahrir/stories`: تبويبات الحالة، بحث، تصفية بالسلسلة، ترقيم خادمي 30/صفحة.
struct StaffStoriesScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    var initialStatus: String? = nil

    @State private var status: String?
    @State private var query = ""
    @State private var submittedQuery = ""
    @State private var seriesSlug: String?
    @State private var rows: [StaffStoryRow] = []
    @State private var counts: [String: Int] = [:]
    @State private var total = 0
    @State private var page = 1
    @State private var perPage = 30
    @State private var loading = false
    @State private var error: ElmAPIError?
    @State private var taxonomy: StaffTaxonomyPayload?
    @State private var newStoryId: String?
    @State private var debugStoryId: String?

    /// ترتيب التبويبات كما في `stories/page.tsx`: الكل، منشورة، للاعتماد، مجدولة، مسودات، الأرشيف.
    private let filters: [(String?, String)] = [(nil, "الكل"), ("published", "منشورة"), ("review", "للاعتماد"), ("scheduled", "مجدولة"), ("draft", "مسودات"), ("archived", "الأرشيف")]

    var body: some View {
        StaffScreen(title: "المواد", showBack: showBack, onRefresh: { await load(page: page) }) {
            VStack(alignment: .leading, spacing: 14) {
                header
                searchBar
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        ForEach(filters, id: \.1) { item in
                            let count = item.0.map { counts[$0] ?? 0 } ?? activeTotal
                            ElmChip(label: count > 0 ? "\(item.1) \(ElmFormat.latinDigits(String(count)))" : item.1, selected: status == item.0) {
                                status = item.0
                                Task { await load(page: 1) }
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                }
                .padding(.horizontal, -18)
                if let taxonomy, !taxonomy.series.isEmpty { seriesPicker(taxonomy) }
                list
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task {
            if status == nil { status = initialStatus }
            if rows.isEmpty { await load(page: 1) }
            if taxonomy == nil { taxonomy = try? await StaffAPI.taxonomy() }
        }
        .navigationDestination(for: StaffStoryRow.self) { row in StaffStoryScreen(id: row.id, seed: row) }
        .navigationDestination(item: $newStoryId) { id in StaffEditorScreen(storyId: id, isNew: true) }
        .navigationDestination(item: $debugStoryId) { id in StaffStoryScreen(id: id) }
        #if DEBUG
        .task { if let id = ElmLaunch.staffStory { try? await Task.sleep(for: .milliseconds(400)); debugStoryId = id } }
        #endif
    }

    /// الخادم يضيف مفتاح `active` جاهزًا؛ وإلا فمجموع الحالات النشطة (بلا `archived` ولا `active` نفسه).
    private var activeTotal: Int {
        counts["active"] ?? counts.filter { $0.key != "archived" && $0.key != "active" }.values.reduce(0, +)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 3) {
                Text("المواد").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                Text(total > 0 ? StaffFormat.storiesCount(total) : " ").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            }
            Spacer()
            if staff.can("story.create") {
                Button { newStoryId = UUID().uuidString.lowercased() } label: {
                    Label("مادة جديدة", systemImage: "plus")
                        .font(ElmFonts.text(.footnote, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(minHeight: 40)
                        .background(ElmTheme.navy, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(ElmTheme.ink3)
            TextField("ابحث في العناوين", text: $query)
                .font(ElmFonts.text(.callout))
                .submitLabel(.search)
                .onSubmit { submittedQuery = query; Task { await load(page: 1) } }
            if !query.isEmpty {
                Button { query = ""; submittedQuery = ""; Task { await load(page: 1) } } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(ElmTheme.ink3).frame(width: 32, height: 32)
                }.accessibilityLabel("مسح البحث")
            }
        }
        .padding(.horizontal, 12).frame(minHeight: 44)
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
    }

    private func seriesPicker(_ taxonomy: StaffTaxonomyPayload) -> some View {
        Menu {
            Button("كل السلاسل") { seriesSlug = nil; Task { await load(page: 1) } }
            ForEach(taxonomy.series) { item in
                Button(item.name) { seriesSlug = item.slug; Task { await load(page: 1) } }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                Text(seriesSlug.flatMap { slug in taxonomy.series.first { $0.slug == slug }?.name } ?? "كل السلاسل")
                Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold))
            }
            .font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.ink2).frame(minHeight: 36)
        }
    }

    @ViewBuilder
    private var list: some View {
        if let error, rows.isEmpty {
            StaffErrorView(error: error) { Task { await load(page: page) } }
        } else if rows.isEmpty && !loading {
            StaffEmptyView(title: "لا مواد في هذه القائمة", detail: submittedQuery.isEmpty ? nil : "جرّب كلمة أخرى أو امسح البحث.", symbol: "doc.text.magnifyingglass")
        } else {
            VStack(spacing: 0) {
                ForEach(rows) { row in
                    NavigationLink(value: row) { StaffStoryRowView(row: row) }.buttonStyle(.plain)
                    Divider().overlay(ElmTheme.line)
                }
            }
            .padding(.horizontal, 14)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
            if let error { StaffInlineError(message: error.message, retry: { Task { await load(page: page) } }) }
            if loading { ProgressView().frame(maxWidth: .infinity).padding(12) }
            pagination
        }
    }

    private var totalPages: Int { max(1, Int(ceil(Double(total) / Double(max(1, perPage))))) }

    @ViewBuilder
    private var pagination: some View {
        if totalPages > 1 {
            HStack {
                Button { Task { await load(page: page - 1) } } label: {
                    Label("السابقة", systemImage: "chevron.right").frame(minHeight: 44)
                }.disabled(page <= 1 || loading)
                Spacer()
                Text("صفحة \(ElmFormat.latinDigits(String(page))) من \(ElmFormat.latinDigits(String(totalPages)))")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                Spacer()
                Button { Task { await load(page: page + 1) } } label: {
                    HStack(spacing: 4) { Text("التالية"); Image(systemName: "chevron.left") }.frame(minHeight: 44)
                }.disabled(page >= totalPages || loading)
            }
            .font(ElmFonts.text(.footnote, weight: .semibold))
            .foregroundStyle(ElmTheme.navyInk)
        }
    }

    @MainActor
    private func load(page target: Int) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let payload = try await StaffAPI.stories(status: status, page: target, query: submittedQuery.isEmpty ? nil : submittedQuery, series: seriesSlug)
            rows = payload.rows
            counts = payload.counts ?? counts
            total = payload.total ?? payload.rows.count
            page = payload.page ?? target
            perPage = payload.perPage ?? perPage
        } catch {
            self.error = staff.handle(error)
        }
    }
}
