import SwiftUI

/// تقارير «جاك العلم» — `/api/mobile/v1/jak`؛ كل بطاقة بشكل `jakalelm` فتفتح القارئ الغامر.
struct JakListScreen: View {
    @State private var stories: [StoryCard] = []
    @State private var loading = false
    @State private var error: String?
    @State private var loaded = false
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    private var columns: [GridItem] {
        let count = typeSize.isAccessibilitySize ? 1 : (sizeClass == .regular ? 3 : 2)
        return Array(repeating: GridItem(.flexible(), spacing: 16, alignment: .top), count: count)
    }

    var body: some View {
        ElmScreen(title: "جاك العلم", showBack: true, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("جاك العلم").font(ElmFonts.display(.largeTitle, weight: .bold)).foregroundStyle(ElmTheme.ink)
                    Text("تقارير مصوّرة بصفحات تُقلَّب — رقم، مقارنة، مسار زمني، وخلاصة.")
                        .font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2).lineSpacing(4)
                }
                if let error, stories.isEmpty {
                    ContentUnavailableView {
                        Label("تعذر تحميل التقارير", systemImage: "wifi.slash")
                    } description: { Text(error) } actions: {
                        Button("إعادة المحاولة") { Task { await load() } }.frame(minHeight: 44)
                    }
                } else if loading && stories.isEmpty {
                    ProgressView("جارٍ تحميل التقارير").font(ElmFonts.text(.caption)).frame(maxWidth: .infinity).padding(.top, 40)
                } else if loaded && stories.isEmpty {
                    ContentUnavailableView("لا تقارير منشورة بعد", systemImage: "rectangle.stack")
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                        ForEach(stories) { story in StoryTile(story: story) }
                    }
                }
                if let error, !stories.isEmpty {
                    Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                }
            }
            .padding(20)
            .frame(maxWidth: sizeClass == .regular ? 1000 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task { if stories.isEmpty { await load() } }
    }

    @MainActor private func load() async {
        guard !loading else { return }
        loading = true
        error = nil
        defer { loading = false; loaded = true }
        do {
            let payload = try await APIClient.fetchJak()
            try Task.checkCancellation()
            var seen = Set<String>()
            stories = payload.stories.filter { seen.insert($0.apiId).inserted }
            ImageStore.shared.prefetch(stories.compactMap(\.imageURL))
        } catch is CancellationError { }
        catch { self.error = ElmAPIError.wrap(error).message }
    }
}
