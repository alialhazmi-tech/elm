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

    var body: some View {
        ElmScreen(title: "السلاسل", showBack: showBack, onRefresh: { await store.load() }) {
            VStack(alignment: .leading, spacing: 0) {
                Text("سلاسل العلم")
                    .font(ElmFonts.display(size: 28, weight: .heavy, relativeTo: .largeTitle))
                    .foregroundStyle(ElmTheme.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("زوايا مختلفة لفهم العالم. اختر السلسلة التي تثير فضولك.")
                    .font(ElmFonts.text(.subheadline))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(4)
                    .padding(.top, 6)
                    .fixedSize(horizontal: false, vertical: true)

                if let error = store.errorMessage {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(error)
                            .font(ElmFonts.text(.caption))
                            .foregroundStyle(ElmTheme.ink3)
                        Spacer(minLength: 0)
                        Button("إعادة المحاولة") { Task { await store.load() } }
                            .font(ElmFonts.text(.caption, weight: .bold))
                            .foregroundStyle(ElmTheme.navyInk)
                            .frame(minHeight: 44)
                    }
                    .padding(.top, 6)
                }

                // قائمة تحريرية بعمود واحد: خط بنية أعلاها وخطوط تفاصيل بين السلاسل — بلا بطاقات فارغة.
                VStack(spacing: 0) {
                    Rectangle().fill(ElmTheme.line2).frame(height: 1).accessibilityHidden(true)
                    ForEach(store.active) { entry in
                        row(entry)
                    }
                }
                .padding(.top, 20)

                if !store.archived.isEmpty {
                    archiveBox.padding(.top, 32)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
        }
        .task { await store.load() }
        .overlay {
            if store.loading && store.active.isEmpty {
                ProgressView().tint(ElmTheme.navy)
            }
        }
    }

    /// صف سلسلة: شرطة بلونها، الاسم بخط العرض، الوصف، وعدد المواد؛ آخر مادة سطرًا خافتًا إن وصلت.
    private func row(_ entry: SeriesEntry) -> some View {
        let color = ElmTheme.hex(entry.color)
        let blurb = entry.description.isEmpty ? SeriesPalette.blurb(for: entry.slug) : entry.description
        return NavigationLink {
            SeriesFeedScreen(chip: entry.asChip, archived: entry.archived)
        } label: {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 1, style: .continuous).fill(color).frame(width: 16, height: 3)
                            .accessibilityHidden(true)
                        Text(entry.name)
                            .font(ElmFonts.display(size: 20, weight: .heavy, relativeTo: .title3))
                            .foregroundStyle(ElmTheme.ink)
                    }
                    Text(blurb)
                        .font(ElmFonts.text(.subheadline))
                        .foregroundStyle(ElmTheme.ink2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        Text(entry.count > 0 ? ElmFormat.materialLabel(entry.count) : "تصفّح السلسلة")
                            .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).elmLatin()
                        if let latest = entry.latest, !latest.title.isEmpty {
                            Text("·").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).accessibilityHidden(true)
                            Text("آخرها: \(latest.title)")
                                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).lineLimit(1)
                        }
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink3)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(entry.name)، \(blurb)، \(entry.count > 0 ? ElmFormat.materialLabel(entry.count) : "")")
    }

    private var archiveBox: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text("✦").font(.system(size: 11)).foregroundStyle(ElmTheme.gold).accessibilityHidden(true)
                Text("أرشيف حي").font(ElmFonts.display(.headline, weight: .heavy)).foregroundStyle(ElmTheme.ink)
            }
            .accessibilityAddTraits(.isHeader)
            .padding(.bottom, 10)
            Rectangle().fill(ElmTheme.line2).frame(height: 1).accessibilityHidden(true)
            Text("سلاسل متقاعدة صفحاتها تعمل ومَوادها محفوظة، خارج حزام الاستكشاف.")
                .font(ElmFonts.text(.subheadline))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
                .padding(.top, 12)
                .fixedSize(horizontal: false, vertical: true)

            ElmFlow(spacing: 8) {
                ForEach(store.archived) { entry in
                    NavigationLink {
                        SeriesFeedScreen(chip: entry.asChip, archived: true)
                    } label: {
                        Text(entry.name)
                            .font(ElmFonts.text(.subheadline, weight: .medium))
                            .foregroundStyle(ElmTheme.ink)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 38)
                            .background(ElmTheme.surface2, in: Capsule())
                            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
