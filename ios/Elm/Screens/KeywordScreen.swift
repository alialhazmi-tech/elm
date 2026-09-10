import SwiftUI

/// مواد كلمة مفتاحية — `/api/mobile/v1/keywords/:keyword` بترقيم الصفحات نفسه في التصفح.
struct KeywordScreen: View {
    let keyword: String
    @State private var stories: [StoryCard] = []
    @State private var total: Int?
    @State private var nextPage: Int? = 1
    @State private var loading = false
    @State private var error: String?
    @State private var notFound = false
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    private var columns: [GridItem] {
        let count = sizeClass == .regular && !typeSize.isAccessibilitySize ? 2 : 1
        return Array(repeating: GridItem(.flexible(), spacing: 24, alignment: .top), count: count)
    }

    var body: some View {
        ElmScreen(title: "كلمة مفتاحية", showBack: true, onRefresh: { await load(reset: true) }) {
            LazyVStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 8) {
                    Image(systemName: "number").font(.system(size: 22, weight: .bold)).foregroundStyle(ElmTheme.gold)
                    Text(keyword).font(ElmFonts.display(.largeTitle, weight: .bold)).foregroundStyle(ElmTheme.ink)
                }.accessibilityElement(children: .combine).accessibilityAddTraits(.isHeader)
                if let total { Text("\(ElmFormat.materialLabel(total)) منشورة").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
                LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                    ForEach(stories) { story in NativeStoryRow(story: story) }
                }
                if notFound {
                    ContentUnavailableView("لا مواد منشورة لهذه الكلمة", systemImage: "doc.text.magnifyingglass")
                } else if let error {
                    Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                    Button("إعادة المحاولة") { Task { await load(reset: stories.isEmpty) } }.frame(minHeight: 44)
                }
                if loading { ProgressView().frame(maxWidth: .infinity).padding(20) }
                else if nextPage != nil && error == nil && !stories.isEmpty {
                    Button("عرض المزيد") { Task { await load(reset: false) } }
                        .font(ElmFonts.text(.body, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 48)
                        .background(ElmTheme.surface2, in: Capsule())
                }
            }
            .padding(20)
            .frame(maxWidth: sizeClass == .regular ? 1000 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task { if stories.isEmpty { await load(reset: true) } }
    }

    @MainActor private func load(reset: Bool) async {
        guard !loading, let page = reset ? 1 : nextPage else { return }
        loading = true
        error = nil
        notFound = false
        defer { loading = false }
        do {
            let result = try await APIClient.fetchKeyword(keyword, page: page)
            try Task.checkCancellation()
            var seen = Set<String>()
            stories = ((reset ? [] : stories) + result.stories).filter { seen.insert($0.apiId).inserted }
            total = result.total
            nextPage = result.nextPage
            ImageStore.shared.prefetch(result.stories.compactMap(\.imageURL))
        } catch is CancellationError { }
        catch let api as ElmAPIError {
            if case .notFound = api { notFound = true; total = 0; nextPage = nil }
            else { error = api.message }
        }
        catch { self.error = ElmAPIError.wrap(error).message }
    }
}
