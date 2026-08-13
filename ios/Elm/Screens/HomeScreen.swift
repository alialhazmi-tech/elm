import SwiftUI

/// 1a — الرئيسية: التاريخ ← العاجل ← حزام السلاسل ← الموجز ← المادة الرئيسية
/// ← المصغّرات ← بالأرقام ← الأكثر قراءة. الترتيب جزء من المواصفة لا تفصيل تنفيذي.
struct HomeScreen: View {
    @State private var store = HomeStore()
    @State private var storiesPresented = false

    var body: some View {
        ElmScreen(showBrand: true, onRefresh: { await store.refresh() }) {
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
                    .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .padding(.horizontal, 18)
                    .padding(.top, 14)
            }

            DayStrip()
                .padding(.horizontal, 18)
                .padding(.top, 14)

            if let breaking = home.breaking {
                BreakingBanner(item: breaking)
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
            }

            SeriesBelt(series: home.series.isEmpty ? SeriesPalette.chips : home.series)
                .padding(.top, 12)

            if !home.brief.isEmpty {
                BriefBlock(items: home.brief) { storiesPresented = true }
                    .padding(.horizontal, 18)
                    .padding(.top, 16)
            }

            HeroCard(story: home.hero)
                .padding(.horizontal, 18)
                .padding(.top, 16)

            if !home.minis.isEmpty {
                VStack(spacing: 10) {
                    ForEach(home.minis) { story in
                        MiniStoryRow(story: story)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)
            }

            if !home.numbers.isEmpty {
                NumbersRail(stats: home.numbers)
                    .padding(.top, 24)
            }

            if !home.mostRead.isEmpty {
                MostReadList(stories: home.mostRead)
                    .padding(.horizontal, 18)
                    .padding(.top, 24)
            }

            if !home.videos.isEmpty {
                VStack(alignment: .leading, spacing: 11) {
                    SectionHead(title: "مرئي ومسموع", subtitle: "المعرفة بأكثر من شكل")
                    ForEach(home.videos.prefix(2)) { story in
                        StoryTile(story: story)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 24)
            }
        }
    }
}

extension SeriesPalette {
    /// حزام احتياطي حين لا يرسل الخادم السلاسل — الطيف نفسه من `series.ts`.
    static var chips: [SeriesChip] {
        active.map { SeriesChip(slug: $0.id, name: $0.name, description: "", color: $0.colorHex) }
    }
}
