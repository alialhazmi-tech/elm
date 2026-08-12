import SwiftUI

/// 1a — الرئيسية: موجز، بنتوهيرو، فسيفساء، سلاسل، أرقام.
struct HomeScreen: View {
    @State private var store = HomeStore()

    var body: some View {
        Group {
            if let home = store.payload {
                homeFeed(home)
            } else if store.loading {
                ProgressView("جاري تحميل الرئيسية")
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView {
                    Label("تعذر تحميل الرئيسية", systemImage: "wifi.slash")
                } description: {
                    Text(store.errorMessage ?? "لا توجد حزمة محفوظة للعرض بلا اتصال.")
                } actions: {
                    Button("إعادة المحاولة") {
                        Task { await store.refresh() }
                    }
                }
            }
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text("العلم")
                        .font(ElmFonts.logo(.title3))
                        .foregroundStyle(ElmTheme.ink)
                    Text("المعرفة بسلاسة")
                        .font(ElmFonts.text(.caption2, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            }
        }
        .task { await store.load() }
        .refreshable { await store.refresh() }
    }

    private func homeFeed(_ home: MobileHomePayload) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if store.fromCache {
                    Text("تُعرض آخر حزمة محفوظة — بلا اتصال أو الخادم لم يرد.")
                        .font(ElmFonts.text(.caption, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ElmTheme.surface2)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .accessibilityLabel("وضع بلا اتصال")
                }

                if let breaking = home.breaking {
                    BreakingBanner(item: breaking)
                }

                DayStrip()

                // الهيرو أولًا: هو واجهة العدد وأول ما يقع عليه البصر — كان سادسًا
                // فتفتح الرئيسية على قوائم نصية بلا صورة حتى تمرّر شاشتين.
                HeroCard(story: home.hero)

                if !home.brief.isEmpty {
                    BriefBlock(items: home.brief)
                }

                ForEach(home.minis) { story in
                    MiniStoryRow(story: story)
                }

                SeriesLensesRow(series: home.series)

                if let data = home.dataStory {
                    DataStoryCard(story: data)
                }

                SectionHead(title: "وراء الخبر", subtitle: "السياق قبل السرعة")
                if let first = home.mosaic.first {
                    MosaicStoryCard(story: first, tall: true)
                }
                if home.mosaic.count > 1 {
                    MosaicStoryCard(story: home.mosaic[1])
                }
                if let question = home.question {
                    QuestionCard(item: question)
                }

                if !home.numbers.isEmpty {
                    NumbersGrid(stats: home.numbers)
                }

                if !home.mostRead.isEmpty {
                    MostReadList(stories: home.mostRead)
                }

                if !home.videos.isEmpty {
                    SectionHead(title: "مرئي وصوتي", subtitle: "المعرفة بأكثر من شكل")
                    ForEach(home.videos) { story in
                        VideoStoryCard(story: story)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }
}
