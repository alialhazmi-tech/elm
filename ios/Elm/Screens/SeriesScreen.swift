import SwiftUI

@MainActor
@Observable
final class SeriesIndexStore {
    var active: [SeriesEntry] = []
    var archived: [SeriesEntry] = []
    var loading = false
    var errorMessage: String?

    func load() async {
        if active.isEmpty { loading = true }
        errorMessage = nil
        do {
            let payload = try await APIClient.fetchSeriesIndex()
            active = payload.series
            archived = payload.archived
        } catch {
            if active.isEmpty {
                active = SeriesPalette.active.map { item in
                    SeriesEntry(
                        slug: item.id,
                        name: item.name,
                        description: SeriesPalette.blurb(for: item.id),
                        color: item.colorHex,
                        archived: false,
                        count: 0,
                        latest: nil
                    )
                }
                errorMessage = "تعذر تحديث السلاسل. يمكنك تصفح الدليل المحفوظ والمحاولة مجددًا."
            }
        }
        loading = false
    }
}

/// 1d — سلاسل العلم: الطيف كاملًا، والأرشيف المتقاعد ظاهر لا محذوف.
struct SeriesScreen: View {
    var showBack = false
    @State private var store = SeriesIndexStore()
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ElmScreen(title: "السلاسل", showBack: showBack, onRefresh: { await store.load() }) {
            VStack(alignment: .leading, spacing: 0) {
                Text("سلاسل العلم")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text("زوايا مختلفة لفهم العالم. اختر السلسلة التي تثير فضولك.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(4)
                    .padding(.top, 6)

                SpectrumBar().padding(.top, 14)

                if let error = store.errorMessage {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(error)
                            .font(ElmFonts.text(.caption2))
                            .foregroundStyle(ElmTheme.ink3)
                        Spacer(minLength: 0)
                        Button("إعادة المحاولة") { Task { await store.load() } }
                            .font(ElmFonts.text(.caption2, weight: .bold))
                            .foregroundStyle(ElmTheme.navyInk)
                            .frame(minHeight: 44)
                    }
                    .padding(.top, 6)
                }

                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(store.active) { entry in
                        card(entry)
                    }
                }
                .padding(.top, 16)

                if !store.archived.isEmpty {
                    archiveBox.padding(.top, 18)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await store.load() }
        .overlay {
            if store.loading && store.active.isEmpty {
                ProgressView().tint(ElmTheme.navy)
            }
        }
    }

    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize
            ? [GridItem(.flexible(), spacing: 10)]
            : [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    }

    private func card(_ entry: SeriesEntry) -> some View {
        let color = ElmTheme.hex(entry.color)
        return NavigationLink {
            SeriesFeedScreen(chip: entry.asChip, archived: entry.archived)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Circle().fill(color).frame(width: 12, height: 12).accessibilityHidden(true)
                Text(entry.name)
                    .font(ElmFonts.display(.headline, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .padding(.top, 3)
                Text(entry.description.isEmpty ? SeriesPalette.blurb(for: entry.slug) : entry.description)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(2)
                    .padding(.top, 4)
                Text(entry.count > 0 ? ElmFormat.materialLabel(entry.count) : "تصفّح السلسلة")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .padding(.top, 9)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: dynamicTypeSize.isAccessibilitySize ? 0 : 132, alignment: .topLeading)
            .padding(14)
            .background(ElmTheme.surface)
            .overlay(alignment: .top) {
                Rectangle().fill(color).frame(height: 3)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))

        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(entry.name)، \(entry.description)")
    }

    private var archiveBox: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("أرشيف حي")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink3)
            Text("سلاسل متقاعدة صفحاتها تعمل ومَوادها محفوظة، خارج حزام الاستكشاف.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
                .padding(.top, 5)

            ElmFlow(spacing: 7) {
                ForEach(store.archived) { entry in
                    NavigationLink {
                        SeriesFeedScreen(chip: entry.asChip, archived: true)
                    } label: {
                        Text(entry.name)
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 5)
                            .background(ElmTheme.surface, in: Capsule())
                            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 10)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }
}

/// 1d↩ — تغذية سلسلة واحدة.
struct SeriesFeedScreen: View {
    let chip: SeriesChip
    /// سلسلة متقاعدة: كيكر «من أرشيف العلم» كما على الويب.
    var archived = false
    var body: some View {
        BrowseFeedScreen(kind: "series", slug: chip.slug, title: chip.name,
                         subtitle: chip.description.isEmpty ? SeriesPalette.blurb(for: chip.slug) : chip.description,
                         kicker: archived ? "من أرشيف العلم" : nil)
    }
}

extension SeriesPalette {
    /// وصف كل سلسلة كما في `lib/content/series.ts` — احتياطي حين لا يرسله الخادم.
    static func blurb(for slug: String) -> String {
        switch slug {
        case "absat": "شرح متدرج للمعقد"
        case "aghrab": "ما لا تتوقعه"
        case "efhamha-sah": "الحقيقة ضد الشائعة"
        case "bel-arqam": "البيانات تحكي"
        case "shakhsiat": "سِيَر صنعت أثرًا"
        case "limatha": "الأسباب خلف الظواهر"
        case "matha-law": "سيناريوهات واحتمالات"
        case "matha-baad": "قراءة التداعيات"
        case "bel-tarikh": "الزمن يعطي السياق"
        default: ""
        }
    }
}

/// تخطيط يلفّ العناصر إلى سطر جديد — لشرائح الأرشيف والاهتمامات.
struct ElmFlow: Layout {
    var spacing: CGFloat = 8

    /// حجم الشريحة: المثالي، وإن تجاوز عرض الحاوية يُقترح عليها العرض فتلتف بدل أن تُقصّ يسارًا.
    private func fitted(_ view: LayoutSubview, in width: CGFloat) -> CGSize {
        let ideal = view.sizeThatFits(.unspecified)
        guard width.isFinite, ideal.width > width else { return ideal }
        return view.sizeThatFits(ProposedViewSize(width: width, height: nil))
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0
        for view in subviews {
            let size = fitted(view, in: width)
            if x + size.width > width, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: width == .infinity ? x : width, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0
        for view in subviews {
            let size = fitted(view, in: bounds.width)
            if x + size.width > bounds.width, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            // التخطيطات المخصّصة لا ترث اتجاه القراءة — نضع من اليمين يدويًا.
            view.place(
                at: CGPoint(x: bounds.maxX - x - size.width, y: bounds.minY + y),
                proposal: ProposedViewSize(size)
            )
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
