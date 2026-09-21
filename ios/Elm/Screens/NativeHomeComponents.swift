import SwiftUI

struct NativeStoryActions: View {
    let story: StoryCard
    @Environment(LibraryStore.self) private var library
    var body: some View {
        HStack(spacing: 0) {
            Button { library.toggle(story) } label: {
                Image(systemName: library.contains(story) ? "bookmark.fill" : "bookmark").frame(width: 44, height: 44)
            }.accessibilityLabel(library.contains(story) ? "إزالة من المحفوظات" : "حفظ لوقت لاحق")
            // رابط المشاركة المُصدَّر إن حملته البطاقة، وإلا الرابط المقدس.
            ShareLink(item: story.shareURL) {
                Image(systemName: "square.and.arrow.up").frame(width: 44, height: 44)
            }.accessibilityLabel("مشاركة المادة")
        }.font(.system(.body)).foregroundStyle(ElmTheme.navyInk).buttonStyle(.plain)
    }
}

/// An editorial cover: generous title, edge-to-edge photograph, quiet reader actions.
struct NativeHomeLead: View {
    let story: StoryCard
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NavigationLink { StoryDestination(seed: story) } label: {
                VStack(alignment: .leading, spacing: 14) {
                    StoryCategoryLabel(story: story)
                    Text(story.title).font(ElmFonts.display(size: 30, weight: .heavy, relativeTo: .title))
                        .foregroundStyle(ElmTheme.ink).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    if story.imageURL != nil {
                        Color.clear.aspectRatio(16 / 9, contentMode: .fit)
                            .overlay { RemoteImage(url: story.imageURL) }
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                    }
                    if !story.excerpt.isEmpty {
                        Text(ElmReaderFormat.trimExcerpt(story.excerpt)).font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2).lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }.contentShape(Rectangle())
            }.buttonStyle(.plain)
            // كما على الويب: «اقرأ الإجابة» لسلسلة «لماذا» وإلا «اقرأ المادة»، والبايلاين «فريق العلم».
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { leadCTA; leadMeta; Spacer(minLength: 0); NativeStoryActions(story: story) }
                VStack(alignment: .leading, spacing: 6) {
                    HStack { leadCTA; Spacer(); NativeStoryActions(story: story) }
                    leadMeta
                }
            }
        }
    }

    private var leadCTA: some View {
        NavigationLink { StoryDestination(seed: story) } label: {
            Label(story.series == "limatha" ? "اقرأ الإجابة" : "اقرأ المادة", systemImage: "arrow.left")
                .font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 44)
        }
    }

    private var leadMeta: some View {
        Text("قراءة \(ElmFormat.countedNoun(story.readingMinutes, one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة"))، تحرير فريق العلم")
            .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).lineLimit(2)
    }
}

struct NativeStoryRow: View {
    let story: StoryCard
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            NavigationLink { StoryDestination(seed: story) } label: {
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 8) {
                        StoryCategoryLabel(story: story)
                        Text(story.title).font(ElmFonts.text(.headline, weight: .semibold))
                            .foregroundStyle(ElmTheme.ink).fixedSize(horizontal: false, vertical: true)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    if story.imageURL != nil && !typeSize.isAccessibilitySize {
                        RemoteImage(url: story.imageURL, height: 90, maxPixel: 320).frame(width: 90)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }.contentShape(Rectangle())
            }.buttonStyle(.plain)
            HStack(spacing: 8) {
                if story.isFresh {
                    // نُشرت خلال الساعة — نقطة الحداثة كما في نهر الويب.
                    Circle().fill(ElmTheme.success).frame(width: 7, height: 7)
                        .accessibilityLabel("نُشرت خلال الساعة")
                }
                if let relative = ElmFormat.relativeTime(story.publishedAt) {
                    Text(relative).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                    Text("·").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).accessibilityHidden(true)
                }
                Text(ElmFormat.readingLabel(story.readingMinutes)).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                Spacer()
                NativeStoryActions(story: story)
            }
            Divider()
        }
    }
}

/// سطر النبض فوق «الجديد الآن»: «نُشرت N مادة خلال 24 ساعة، آخرها …» كما على الويب.
struct HomePulseLine: View {
    let pulse: HomePulse
    var body: some View {
        Text(text)
            .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
            .fixedSize(horizontal: false, vertical: true)
    }
    private var text: String {
        var line = pulse.todayCount > 0
            ? "نُشرت \(ElmFormat.latinDigits(String(pulse.todayCount))) مادة خلال 24 ساعة"
            : "آخر ما نُشر"
        if let last = ElmFormat.relativeTime(pulse.lastAt) { line += "، آخرها \(last)" }
        return line
    }
}

/// «في الأقسام»: لوحة لكل قسم ظاهر في التصنيف — قائد بصورة، ثم صفوف، وعدّاد 24 ساعة.
struct HomeSectionPanels: View {
    let panels: [HomeSectionPanel]
    var wide = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHead(title: "في الأقسام", subtitle: "أحدث القصص مرتبة حسب المجال")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 20, alignment: .top), count: wide ? 2 : 1), alignment: .leading, spacing: 20) {
                ForEach(panels) { panel in HomeSectionPanelView(panel: panel) }
            }
        }
    }
}

struct HomeSectionPanelView: View {
    let panel: HomeSectionPanel
    private var color: Color { ElmTheme.hex(panel.color) }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                NavigationLink { BrowseFeedScreen(slug: panel.slug, title: panel.name) } label: {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 1, style: .continuous).fill(color).frame(width: 14, height: 3).accessibilityHidden(true)
                        Text(panel.name).font(ElmFonts.display(.headline, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    }.frame(minHeight: 32)
                }.buttonStyle(.plain).accessibilityLabel("قسم \(panel.name)")
                Spacer(minLength: 0)
                NavigationLink { BrowseFeedScreen(slug: panel.slug, title: panel.name) } label: {
                    Text("كل القسم").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 32)
                }.buttonStyle(.plain).accessibilityLabel("كل مواد \(panel.name)")
            }
            Text(panel.todayCount > 0 ? "\(ElmFormat.latinDigits(String(panel.todayCount))) جديدة خلال 24 ساعة" : "أحدث ما في القسم")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            if let lead = panel.lead {
                NavigationLink { StoryDestination(seed: lead) } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        if lead.imageURL != nil {
                            Color.clear.aspectRatio(16 / 9, contentMode: .fit)
                                .overlay { RemoteImage(url: lead.imageURL) }
                                .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
                        }
                        StoryCategoryLabel(story: lead)
                        Text(lead.title).font(ElmFonts.text(.headline, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    }.contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityLabel("\(panel.name)، \(lead.title)")
            }
            ForEach(panel.rows) { row in
                NavigationLink { StoryDestination(seed: row) } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Rectangle().fill(ElmTheme.line).frame(height: 1)
                        StoryCategoryLabel(story: row).padding(.top, 8)
                        Text(row.title).font(ElmFonts.text(.subheadline, weight: .medium)).foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    }.contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityLabel(row.title)
            }
        }
        .padding(16)
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .overlay(alignment: .top) { Rectangle().fill(color).frame(height: 3).padding(.horizontal, 20).accessibilityHidden(true) }
    }
}

/// عدسات «السلاسل»: اسم السلسلة + عنوان أحدث مادة + العدد، كما في الرئيسية على الويب.
struct HomeSeriesLenses: View {
    let entries: [SeriesEntry]
    @Environment(\.dynamicTypeSize) private var typeSize
    var wide = false
    private var columns: [GridItem] {
        let count = typeSize.isAccessibilitySize ? 1 : (wide ? 3 : 2)
        return Array(repeating: GridItem(.flexible(), spacing: 10, alignment: .top), count: count)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                SectionHead(title: "السلاسل", subtitle: "زوايا متعددة لفهم الخبر")
                NavigationLink { SeriesScreen(showBack: true) } label: {
                    Text("كل السلاسل").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 32)
                }.buttonStyle(.plain)
            }
            LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                ForEach(entries) { entry in
                    let color = ElmTheme.hex(entry.color)
                    NavigationLink { SeriesFeedScreen(chip: entry.asChip, archived: entry.archived) } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.name).font(ElmFonts.display(.subheadline, weight: .heavy)).foregroundStyle(color)
                            Text(entry.latest?.title ?? (entry.description.isEmpty ? SeriesPalette.blurb(for: entry.slug) : entry.description))
                                .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink)
                                .multilineTextAlignment(.leading).lineLimit(3).lineSpacing(3)
                            if entry.count > 0 {
                                Text("\(ElmFormat.latinDigits(String(entry.count))) مادة").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(minHeight: typeSize.isAccessibilitySize ? 0 : 108, alignment: .topLeading)
                        .padding(12)
                        .background(ElmTheme.surface)
                        .overlay(alignment: .top) { Rectangle().fill(color).frame(height: 3) }
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("سلسلة \(entry.name)\(entry.latest.map { "، آخرها: \($0.title)" } ?? "")")
                }
            }
        }
    }
}

struct NativeBriefEntry: View {
    let home: MobileHomePayload
    var body: some View {
        NavigationLink {
            ElmScreen(title: "موجز العلم", showBack: true, showTools: false) {
                HomeBriefCard(items: home.brief, presentation: home.presentation).padding(18)
            }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "text.alignright").font(.system(.title2)).frame(width: 44, height: 44)
                    .background(ElmTheme.surface, in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("موجز العلم").font(ElmFonts.display(.headline, weight: .bold))
                    Text("\(home.brief.count) عناوين للقراءة أو الاستماع").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.left").font(.system(.caption, weight: .semibold))
            }.foregroundStyle(ElmTheme.ink).padding(14).background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 20))
        }.buttonStyle(.plain)
    }
}
