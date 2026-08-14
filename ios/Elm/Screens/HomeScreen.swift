import SwiftUI

/// 1a — الرئيسية بلغة «الطبعة التحريرية»: التاريخ ← العاجل ← سكة السلاسل
/// ← منطقة الصدارة (الصدارة ثم الموجز كما تتراص أعمدة الويب على الهاتف)
/// ← صفوف السياق ← سؤال الأسبوع ← بالأرقام ← الأكثر قراءة ← مرئي ← الختام.
struct HomeScreen: View {
    @State private var store = HomeStore()
    @State private var storiesPresented = false

    var body: some View {
        ElmScreen(showBrand: true, bottomInset: 76, onRefresh: { await store.refresh() }) {
            if let home = store.payload {
                feed(home)
            } else if store.loading {
                ProgressView("جاري تحميل الرئيسية")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 140)
            } else {
                ContentUnavailableView {
                    Label("تعذر تحميل الرئيسية", systemImage: "wifi.slash")
                } description: {
                    Text(store.errorMessage ?? "لا توجد حزمة محفوظة للعرض بلا اتصال.")
                } actions: {
                    Button("إعادة المحاولة") { Task { await store.refresh() } }
                }
                .padding(.top, 90)
            }
        }
        .task { await store.load() }
        .fullScreenCover(isPresented: $storiesPresented) {
            StoriesScreen(items: store.payload?.brief ?? []).elmRTL()
        }
    }

    @ViewBuilder
    private func feed(_ home: MobileHomePayload) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if store.fromCache {
                Label("تُعرض آخر حزمة محفوظة — بلا اتصال أو الخادم لم يرد.", systemImage: "arrow.down.circle")
                    .font(ElmFonts.text(.caption, weight: .medium))
                    .foregroundStyle(ElmTheme.ink2)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ElmTheme.surface2)
                    .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
            }

            DayStrip()
                .padding(.horizontal, 18)
                .padding(.top, 14)

            if let breaking = home.breaking {
                BreakingBanner(item: breaking)
                    .padding(.top, 12)
            }

            SeriesBelt(series: home.series.isEmpty ? SeriesPalette.chips : home.series)
                .padding(.top, home.breaking == nil ? 12 : 0)

            LeadRegion(
                hero: home.hero,
                brief: home.brief,
                related: [home.hero] + home.minis + [home.dataStory].compactMap { $0 }
            ) { storiesPresented = true }
                .padding(.top, 14)

            if !home.minis.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(home.minis.enumerated()), id: \.element.id) { index, story in
                        MiniStoryRow(story: story, first: index == 0)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 6)
            }

            if let question = home.question {
                WhyPanel(question: question)
                    .padding(.horizontal, 18)
                    .padding(.top, 30)
            }

            if !home.numbers.isEmpty {
                NumbersRail(stats: home.numbers)
                    .padding(.horizontal, 18)
                    .padding(.top, 30)
            }

            if !home.mostRead.isEmpty {
                MostReadList(stories: home.mostRead)
                    .padding(.horizontal, 18)
                    .padding(.top, 30)
            }

            if !home.videos.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    SectionHead(title: "مرئي ومسموع", subtitle: "المعرفة بأكثر من شكل")
                    VStack(alignment: .leading, spacing: 22) {
                        ForEach(home.videos.prefix(2)) { story in
                            StoryTile(story: story)
                        }
                    }
                    .padding(.top, 16)
                }
                .padding(.horizontal, 18)
                .padding(.top, 30)
            }

            HomeFooter()
                .padding(.top, 40)
        }
    }
}

extension SeriesPalette {
    /// سكة احتياطية حين لا يرسل الخادم السلاسل — الطيف نفسه من `series.ts`.
    static var chips: [SeriesChip] {
        active.map { SeriesChip(slug: $0.id, name: $0.name, description: "", color: $0.colorHex) }
    }
}
