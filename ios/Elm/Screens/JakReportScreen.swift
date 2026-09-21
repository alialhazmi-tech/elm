import SwiftUI

/// قارئ تقارير «جاك العلم» — الصورة تملأ الشاشة والنص موزّع بحسب نوع الصفحة.
/// المقاسات مأخوذة حرفيًا من النموذج المعتمد (مقاس النموذج × ١٫١٨ ليصير نقاطًا).
struct JakReportScreen: View {
    let seed: StoryCard

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(LibraryStore.self) private var library
    @Environment(ReadingStore.self) private var reading
    @Environment(ChromeState.self) private var chrome

    @State private var detail: StoryDetailPayload?
    @State private var index = 0
    @State private var loading = true
    @State private var loadError: String?
    @State private var dragOffset: CGFloat = 0
    @State private var readingText = false

    private var slides: [StorySlide] { detail?.slides ?? [] }
    private var report: JakReport { detail?.jak ?? .economy }
    private var story: StoryCard { detail?.story ?? seed }
    private var current: StorySlide? { slides.indices.contains(index) ? slides[index] : nil }

    /// أول صورة في التقرير: ترثها الصفحات بلا صورة خاصة فتبقى الحالة البصرية متصلة.
    private var coverImage: URL? {
        slides.first(where: { $0.imageURL != nil })?.imageURL ?? story.imageURL
    }

    var body: some View {
        ZStack {
            report.baseColor.ignoresSafeArea()

            if let slide = current {
                backdrop(for: slide)
                    .id(slide.id)
                    .transition(.opacity)
                tapZones
                page(slide)
            } else if loading {
                ProgressView().tint(.white)
            } else {
                unavailable
            }
        }
        .offset(y: dragOffset)
        .gesture(navigationGesture)
        .statusBarHidden()
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { chrome.immersive = true }
        .onDisappear { chrome.immersive = false }
        .task {
            reading.markRead()
            await load()
        }
        .fullScreenCover(isPresented: $readingText) {
            NavigationStack { StoryDetailScreen(seed: story) }.elmRTL()
        }
    }

    // MARK: الخلفية

    @ViewBuilder
    private func backdrop(for slide: StorySlide) -> some View {
        let kind = kind(of: slide)
        ZStack {
            if let url = slide.imageURL {
                KenBurns(url: url, active: !reduceMotion)
            } else if let cover = coverImage {
                // ثماني صفحات من اثنتي عشرة بلا صورة خاصة: تُستعار صورة الغلاف
                // مموّهة ومعتّمة بدل خلفية صمّاء.
                FullBleedImage(url: cover)
                    .blur(radius: kind == .stat ? 16 : 9)
                    .scaleEffect(1.14)
                    .opacity(kind == .stat ? 0.50 : 0.34)
            }
        }
        .ignoresSafeArea()
        .overlay { wash(for: kind).ignoresSafeArea() }
    }

    private func wash(for kind: PageKind) -> LinearGradient {
        let base = report.baseColor
        switch kind {
        case .cover, .closing:
            return LinearGradient(
                stops: [
                    .init(color: base.opacity(0.97), location: 0.06),
                    .init(color: base.opacity(0.70), location: 0.34),
                    .init(color: base.opacity(0.06), location: 0.72),
                ],
                startPoint: .bottom, endPoint: .top
            )
        case .quote:
            return LinearGradient(
                stops: [
                    .init(color: base.opacity(0.93), location: 0.10),
                    .init(color: base.opacity(0.42), location: 0.50),
                    .init(color: base.opacity(0.86), location: 1.0),
                ],
                startPoint: .bottom, endPoint: .top
            )
        case .stat:
            return LinearGradient(
                stops: [
                    .init(color: base.opacity(0.95), location: 0.0),
                    .init(color: report.base2Color.opacity(0.42), location: 0.48),
                    .init(color: base.opacity(0.95), location: 1.0),
                ],
                startPoint: .bottom, endPoint: .top
            )
        default:
            return LinearGradient(
                stops: [
                    .init(color: base.opacity(0.96), location: 0.14),
                    .init(color: base.opacity(0.80), location: 0.58),
                    .init(color: base.opacity(0.62), location: 1.0),
                ],
                startPoint: .bottom, endPoint: .top
            )
        }
    }

    // MARK: الصفحة

    @ViewBuilder
    private func page(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            bars
            topRow(slide)

            switch placement(of: slide) {
            case .bottom:
                Spacer(minLength: 12)
                content(slide)
            case .middle:
                Spacer(minLength: 8)
                content(slide)
                Spacer(minLength: 8)
            case .top:
                content(slide).padding(.top, 22)
                Spacer(minLength: 12)
            }

            actions
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func content(_ slide: StorySlide) -> some View {
        switch kind(of: slide) {
        case .cover: cover(slide)
        case .stat: stat(slide)
        case .comparison: comparison(slide)
        case .timeline: timeline(slide)
        case .list: list(slide)
        case .quote: quote(slide)
        case .closing: closing(slide)
        case .text: text(slide)
        }
    }

    // الغلاف — العنوان في الثلث السفلي.
    private func cover(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            eyebrow(slide.eyebrow ?? "تقرير العلم")
            Text(slide.title)
                .font(ElmFonts.display(size: 34, weight: .heavy, relativeTo: .largeTitle))
                .foregroundStyle(.white)
                .lineSpacing(5)
                .padding(.top, 11)
            Text(slide.body)
                .font(ElmFonts.text(size: 15.5, relativeTo: .callout))
                .foregroundStyle(.white.opacity(0.80))
                .lineSpacing(10)
                .padding(.top, 11)
            HStack(spacing: 7) {
                Circle().fill(report.glowColor).frame(width: 6, height: 6)
                Text("تقرير من ")
                    + Text("جاك العلم").foregroundColor(report.glow2Color).bold()
                    + Text(" · \(ElmFormat.latinDigits(String(slides.count))) صفحة")
            }
            .font(ElmFonts.text(size: 13, relativeTo: .caption))
            .foregroundStyle(.white.opacity(0.58))
            .padding(.top, 14)
        }
        .multilineTextAlignment(.leading)
    }

    // الرقم — في منتصف الشاشة، يعدّ تصاعديًا عند ظهوره.
    private func stat(_ slide: StorySlide) -> some View {
        VStack(spacing: 0) {
            eyebrow(slide.title, centered: true)
            CountUpNumber(raw: slide.stat ?? "", report: report, animated: !reduceMotion)
                .padding(.top, 16)
            if let label = slide.statLabel, !label.isEmpty {
                Text(label)
                    .font(ElmFonts.text(size: 16.5, weight: .medium, relativeTo: .callout))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .lineSpacing(6)
                    .frame(maxWidth: 280)
                    .padding(.top, 12)
            }
            RoundedRectangle(cornerRadius: 2)
                .fill(report.glowColor)
                .frame(width: 44, height: 2)
                .padding(.vertical, 16)
            Text(slide.body)
                .font(ElmFonts.text(size: 15.5, relativeTo: .callout))
                .foregroundStyle(.white.opacity(0.80))
                .multilineTextAlignment(.center)
                .lineSpacing(10)
        }
        .frame(maxWidth: .infinity)
    }

    // المقارنة — طرفان بشريطين متناسبين.
    private func comparison(_ slide: StorySlide) -> some View {
        let sides = slide.sides ?? []
        return VStack(alignment: .leading, spacing: 0) {
            eyebrow(slide.eyebrow ?? "مقارنة")
            pageTitle(slide.title)
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(sides.enumerated()), id: \.offset) { position, side in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(side.label)
                            .font(ElmFonts.text(size: 14, relativeTo: .footnote))
                            .foregroundStyle(.white.opacity(0.72))
                        Text(ElmFormat.latinDigits(side.value))
                            .font(ElmFonts.display(size: 40, weight: .heavy, relativeTo: .largeTitle))
                            .foregroundStyle(position == 0 ? report.glow2Color : .white)
                            .elmLatin()
                            .padding(.top, 2)
                        ProportionBar(
                            fraction: fraction(of: side.value),
                            highlighted: position == 0,
                            report: report
                        )
                        .padding(.top, 9)
                    }
                }
            }
            .padding(.top, 20)
            dek(slide.body).padding(.top, 16)
        }
    }

    // المسار الزمني — يبدأ من الأعلى، والمحطة الأخيرة موسومة بلون التقرير.
    private func timeline(_ slide: StorySlide) -> some View {
        let points = slide.points ?? []
        return VStack(alignment: .leading, spacing: 0) {
            eyebrow(slide.eyebrow ?? "مسار زمني")
            pageTitle(slide.title)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(points.enumerated()), id: \.offset) { position, point in
                    timelineRow(point, last: position == points.count - 1)
                }
            }
            .padding(.top, 20)
        }
    }

    /// السكة والنقطة طبقتان فوق الصف نفسه: لا عمود مرن يمطّ الارتفاع،
    /// ولا `offset` أفقي — فالإزاحة لا تنقلب مع اتجاه القراءة.
    private func timelineRow(_ point: SlidePoint, last: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(ElmFormat.latinDigits(point.year))
                .font(ElmFonts.display(size: 15, weight: .heavy, relativeTo: .footnote))
                .foregroundStyle(report.glowColor)
                .elmLatin()
            Text(point.title)
                .font(ElmFonts.display(size: 17.5, weight: .bold, relativeTo: .headline))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .padding(.top, 3)
            Text(point.detail)
                .font(ElmFonts.text(size: 14, relativeTo: .footnote))
                .foregroundStyle(.white.opacity(0.68))
                .multilineTextAlignment(.leading)
                .lineSpacing(6)
                .padding(.top, 3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 22)
        .padding(.bottom, last ? 0 : 20)
        .overlay(alignment: .topLeading) {
            if !last {
                Rectangle()
                    .fill(.white.opacity(0.20))
                    .frame(width: 1.5)
                    .padding(.leading, 3.75)
                    .padding(.top, 12)
            }
        }
        .overlay(alignment: .topLeading) {
            Circle()
                .fill(last ? report.glowColor : Color.white.opacity(0.34))
                .frame(width: 9, height: 9)
                .background(
                    Circle()
                        .fill(report.glowColor.opacity(last ? 0.22 : 0))
                        .frame(width: 18, height: 18)
                )
                .padding(.top, 7)
        }
        .accessibilityElement(children: .combine)
    }

    // القائمة — عناصر مرقّمة بدوائر بلون التقرير.
    private func list(_ slide: StorySlide) -> some View {
        let items = slide.items ?? []
        return VStack(alignment: .leading, spacing: 0) {
            eyebrow(slide.eyebrow ?? "محاور")
            pageTitle(slide.title)
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(items.enumerated()), id: \.offset) { position, item in
                    HStack(alignment: .top, spacing: 12) {
                        Text(ElmFormat.latinDigits(String(position + 1)))
                            .font(ElmFonts.display(size: 13, weight: .heavy, relativeTo: .caption))
                            .foregroundStyle(report.baseColor)
                            .frame(width: 24, height: 24)
                            .background(report.glowColor, in: Circle())
                        Text(item)
                            .font(ElmFonts.text(size: 15, relativeTo: .callout))
                            .foregroundStyle(.white.opacity(0.88))
                            .lineSpacing(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(.top, 20)
        }
    }

    // الاقتباس — في المنتصف بحدّ ذهبي على جهة القراءة.
    private func quote(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("”")
                .font(ElmFonts.display(size: 73, weight: .heavy, relativeTo: .largeTitle))
                .foregroundStyle(report.glowColor.opacity(0.85))
                .frame(height: 44, alignment: .top)
                .accessibilityHidden(true)
            Text(slide.body)
                .font(ElmFonts.display(size: 23.5, weight: .medium, relativeTo: .title2))
                .foregroundStyle(.white)
                .lineSpacing(12)
                .padding(.leading, 15)
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2).fill(report.glowColor).frame(width: 3)
                }
                .padding(.top, 14)
            if let by = slide.quoteBy, !by.isEmpty {
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 2).fill(report.glowColor).frame(width: 26, height: 2)
                    Text(by)
                        .font(ElmFonts.text(size: 14, relativeTo: .footnote))
                        .foregroundStyle(.white.opacity(0.70))
                }
                .padding(.top, 16)
            }
        }
        .multilineTextAlignment(.leading)
    }

    // صفحة نص عادية — بصورتها إن وُجدت.
    private func text(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            eyebrow(slide.eyebrow ?? "من التقرير")
            pageTitle(slide.title)
            dek(slide.body).padding(.top, 11)
        }
    }

    // الختام — خلاصة ومشاركة وحفظ وتلميح للتالي.
    private func closing(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            eyebrow(slide.eyebrow ?? "خلاصة")
            pageTitle(slide.title)
            dek(slide.body).padding(.top, 11)

            HStack(spacing: 9) {
                ShareLink(item: URLConstants.publicURL(path: story.path)) {
                    Text("شارك التقرير")
                        .font(ElmFonts.text(size: 15, weight: .bold, relativeTo: .subheadline))
                        .foregroundStyle(report.baseColor)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(report.glowColor, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)

                Button { library.toggle(story) } label: {
                    Text(library.contains(story) ? "محفوظ" : "احفظه")
                        .font(ElmFonts.text(size: 15, weight: .bold, relativeTo: .subheadline))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(.white.opacity(0.13), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(.white.opacity(0.24), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 16)

            if let next = detail?.nextInSeries {
                Text("التقرير التالي · \(next.title)")
                    .font(ElmFonts.text(size: 13, relativeTo: .caption))
                    .foregroundStyle(.white.opacity(0.55))
                    .lineLimit(1)
                    .padding(.top, 13)
            }
        }
    }

    // MARK: قطع مشتركة

    private func eyebrow(_ label: String, centered: Bool = false) -> some View {
        HStack(spacing: 7) {
            if !centered {
                RoundedRectangle(cornerRadius: 2).fill(report.glowColor).frame(width: 15, height: 2)
            }
            Text(label)
                .font(ElmFonts.display(size: 12.5, weight: .heavy, relativeTo: .caption2))
                .tracking(1.1)
            Spacer(minLength: 0)
        }
        .foregroundStyle(report.glowColor)
        .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
    }

    private func pageTitle(_ title: String) -> some View {
        Text(title)
            .font(ElmFonts.display(size: 27, weight: .heavy, relativeTo: .title))
            .foregroundStyle(.white)
            .multilineTextAlignment(.leading)
            .lineSpacing(6)
            .padding(.top, 10)
    }

    private func dek(_ body: String) -> some View {
        Text(body)
            .font(ElmFonts.text(size: 15.5, relativeTo: .callout))
            .foregroundStyle(.white.opacity(0.80))
            .multilineTextAlignment(.leading)
            .lineSpacing(10)
    }

    private var bars: some View {
        HStack(spacing: 4) {
            ForEach(slides.indices, id: \.self) { slot in
                Capsule()
                    .fill(.white.opacity(0.26))
                    .frame(height: 2.5)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(.white)
                            .frame(maxWidth: slot <= index ? .infinity : 0)
                    }
            }
        }
        .padding(.top, 18)
        .accessibilityHidden(true)
    }

    private func topRow(_ slide: StorySlide) -> some View {
        HStack(spacing: 9) {
            Text("العلم")
                .font(ElmFonts.logo(.title3))
                .foregroundStyle(.white)
            Text("تقرير · \(ElmFormat.latinDigits("\(index + 1)/\(slides.count)"))")
                .font(ElmFonts.text(size: 12.5, relativeTo: .caption2))
                .foregroundStyle(.white.opacity(0.66))
            Spacer(minLength: 0)
            Text(kindName(of: slide))
                .font(ElmFonts.text(size: 12, weight: .semibold, relativeTo: .caption2))
                .foregroundStyle(report.glowColor)
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .background(report.glowColor.opacity(0.14), in: Capsule())
                .overlay(Capsule().stroke(report.glowColor.opacity(0.32), lineWidth: 1))
        }
        .padding(.top, 15)
    }

    private var actions: some View {
        HStack(spacing: 8) {
            Button { readingText = true } label: {
                Text("اقرأ التقرير نصًا")
                    .font(ElmFonts.text(size: 15, weight: .bold, relativeTo: .subheadline))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(.white.opacity(0.13), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .stroke(.white.opacity(0.22), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)

            ShareLink(item: URLConstants.publicURL(path: story.path)) {
                glassCircle("square.and.arrow.up")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("شارك التقرير")

            Button { dismiss() } label: { glassCircle("xmark") }
                .buttonStyle(.plain)
                .accessibilityLabel("إغلاق التقرير")
        }
        .padding(.top, 14)
        .padding(.bottom, 12)
    }

    private func glassCircle(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 42, height: 42)
            .background(.white.opacity(0.13), in: Circle())
            .overlay(Circle().stroke(.white.opacity(0.22), lineWidth: 1))
    }

    private var unavailable: some View {
        VStack(spacing: 14) {
            Text(loadError ?? "تعذر تحميل صفحات التقرير.")
                .font(ElmFonts.text(size: 15.5, relativeTo: .callout))
                .foregroundStyle(.white.opacity(0.8))
                .multilineTextAlignment(.center)
            Button("اقرأ المادة نصًا") { readingText = true }
                .font(ElmFonts.text(size: 15, weight: .bold, relativeTo: .subheadline))
                .foregroundStyle(report.glow2Color)
            Button("إغلاق") { dismiss() }
                .font(ElmFonts.text(size: 14, relativeTo: .footnote))
                .foregroundStyle(.white.opacity(0.6))
        }
        .padding(30)
    }

    // MARK: التنقل

    private var tapZones: some View {
        HStack(spacing: 0) {
            zone { advance(1) }   // اليسار: الصفحة التالية في اتجاه القراءة العربية
            zone { advance(-1) }  // اليمين: السابقة
        }
        // اتجاه صريح: ترتيب المناطق يجب ألا ينقلب مع بيئة RTL.
        .environment(\.layoutDirection, .leftToRight)
        .ignoresSafeArea()
    }

    private func zone(_ action: @escaping () -> Void) -> some View {
        Color.clear
            .contentShape(Rectangle())
            .onTapGesture(perform: action)
    }

    private var navigationGesture: some Gesture {
        DragGesture(minimumDistance: 14)
            .onChanged { value in
                if value.translation.height > 0, abs(value.translation.width) < 40 {
                    dragOffset = value.translation.height
                }
            }
            .onEnded { value in
                if value.translation.height > 120 {
                    dismiss()
                    return
                }
                if value.translation.width > 60 {
                    advance(-1)
                } else if value.translation.width < -60 {
                    advance(1)
                }
                withAnimation(.snappy) { dragOffset = 0 }
            }
    }

    private func advance(_ delta: Int) {
        let next = index + delta
        guard !slides.isEmpty else { return }
        if next < 0 { return }
        if next >= slides.count {
            dismiss()
            return
        }
        // إحماء الصور للشرائح القادمة والسابقة لتظهر بدون أي تأخير
        let upcomingIndices = [next, next + 1, next + 2, next - 1]
        let upcomingURLs = upcomingIndices
            .compactMap { slides.indices.contains($0) ? slides[$0].imageURL : nil }
        if !upcomingURLs.isEmpty {
            ImageStore.shared.prefetch(upcomingURLs, maxPixel: 1400)
        }
        withAnimation(.easeInOut(duration: 0.22)) { index = next }
    }

    // MARK: الأنواع

    private enum PageKind { case cover, stat, comparison, timeline, list, quote, closing, text }
    private enum Placement { case top, middle, bottom }

    private func kind(of slide: StorySlide) -> PageKind {
        if slide.sides?.isEmpty == false { return .comparison }
        if slide.points?.isEmpty == false { return .timeline }
        if slide.items?.isEmpty == false { return .list }
        switch slide.type {
        case "hero": return .cover
        case "quote": return .quote
        case "end", "summary": return .closing
        default: break
        }
        if let stat = slide.stat, !stat.isEmpty { return .stat }
        return .text
    }

    private func placement(of slide: StorySlide) -> Placement {
        switch kind(of: slide) {
        case .cover, .closing: return .bottom
        case .stat, .quote, .comparison: return .middle
        case .timeline, .list: return .top
        case .text: return slide.imageURL != nil ? .bottom : .middle
        }
    }

    private func kindName(of slide: StorySlide) -> String {
        switch kind(of: slide) {
        case .cover: "الغلاف"
        case .stat: "رقم"
        case .comparison: "مقارنة"
        case .timeline: "مسار زمني"
        case .list: "محاور"
        case .quote: "اقتباس"
        case .closing: "الختام"
        case .text: "من التقرير"
        }
    }

    /// نسبة الشريط من قيمة مثل «61%» — وإن لم تكن نسبة فالشريط ممتلئ.
    private func fraction(of value: String) -> CGFloat {
        let digits = ElmFormat.latinDigits(value)
        let number = digits.filter { $0.isNumber || $0 == "." }
        guard let parsed = Double(number) else { return 1 }
        return CGFloat(min(1, max(0.06, parsed / 100)))
    }

    private func load() async {
        // استحضار فوري من الكاش أولاً (0ms) لعرض التقرير بدون انتظار الشبكة
        if detail == nil, let cached = AppCache.loadStory(id: seed.apiId) {
            detail = cached
            loading = false
            prefetchSlideImages(for: cached)
        } else {
            loading = detail == nil
        }

        do {
            let fresh = try await APIClient.fetchStory(id: seed.apiId)
            detail = fresh
            AppCache.saveStory(fresh)
            prefetchSlideImages(for: fresh)
            if fresh.slides?.isEmpty != false {
                loadError = "هذه المادة ليست تقريرًا مصوّرًا."
            }
        } catch {
            if detail == nil {
                if let cached = AppCache.loadStory(id: seed.apiId) {
                    detail = cached
                    prefetchSlideImages(for: cached)
                } else {
                    loadError = "تعذر تحميل التقرير. جرّب عند عودة الاتصال."
                }
            }
        }
        loading = false
    }

    /// تنزيل وفك ترميز كافة صور شرائح التقرير فوراً في الذاكرة لتكون جاهزة عند التقليب
    private func prefetchSlideImages(for payload: StoryDetailPayload) {
        var urls = [payload.story.imageURL].compactMap { $0 }
        if let slideURLs = payload.slides?.compactMap(\.imageURL) {
            urls.append(contentsOf: slideURLs)
        }
        ImageStore.shared.prefetch(urls, maxPixel: 1400)
    }
}

// MARK: - قطع مساعدة

/// رقم يعدّ تصاعديًا عند ظهوره — «4.5%» و«30 مليون» و«168 مليار ر.س».
private struct CountUpNumber: View {
    let raw: String
    let report: JakReport
    let animated: Bool

    @State private var shown: Double = 0

    private var parsed: (value: Double, decimals: Int, suffix: String) {
        let text = ElmFormat.latinDigits(raw)
        var digits = ""
        var suffix = ""
        var seenNumber = false
        for character in text {
            if !seenNumber || (character.isNumber || character == ".") {
                if character.isNumber || (character == "." && !digits.isEmpty) {
                    digits.append(character)
                    seenNumber = true
                    continue
                }
                if !seenNumber { continue }
            }
            suffix.append(character)
        }
        let value = Double(digits) ?? 0
        let decimals = digits.contains(".") ? 1 : 0
        return (value, decimals, suffix.trimmingCharacters(in: .whitespaces))
    }

    var body: some View {
        let target = parsed
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(format(shown, decimals: target.decimals))
                .font(ElmFonts.display(size: 113, weight: .heavy, relativeTo: .largeTitle))
            if !target.suffix.isEmpty {
                Text(target.suffix)
                    .font(ElmFonts.display(size: 45, weight: .heavy, relativeTo: .title))
                    .opacity(0.72)
            }
        }
        .foregroundStyle(
            LinearGradient(colors: [report.glow2Color, report.glowColor], startPoint: .top, endPoint: .bottom)
        )
        .lineLimit(1)
        .minimumScaleFactor(0.45)
        .elmLatin()
        .accessibilityLabel(raw)
        .task(id: raw) {
            guard animated, target.value > 0 else {
                shown = target.value
                return
            }
            shown = 0
            let steps = 32
            for step in 1...steps {
                try? await Task.sleep(for: .milliseconds(26))
                if Task.isCancelled { return }
                // تباطؤ في النهاية: الرقم يستقر بدل أن يتوقف فجأة.
                let progress = Double(step) / Double(steps)
                shown = target.value * (1 - pow(1 - progress, 3))
            }
            shown = target.value
        }
    }

    private func format(_ value: Double, decimals: Int) -> String {
        decimals == 0 ? String(Int(value.rounded())) : String(format: "%.1f", value)
    }
}

/// شريط نسبة بلون التقرير — الطرف الأول مضيء والثاني أبيض خافت.
private struct ProportionBar: View {
    let fraction: CGFloat
    let highlighted: Bool
    let report: JakReport

    @State private var grown = false

    var body: some View {
        Capsule()
            .fill(.white.opacity(0.16))
            .frame(height: 7)
            .overlay(alignment: .leading) {
                GeometryReader { proxy in
                    Capsule()
                        .fill(
                            highlighted
                                ? AnyShapeStyle(LinearGradient(
                                    colors: [report.glowColor, report.glow2Color],
                                    startPoint: .leading, endPoint: .trailing))
                                : AnyShapeStyle(Color.white.opacity(0.42))
                        )
                        .frame(width: proxy.size.width * (grown ? fraction : 0))
                }
            }
            .clipShape(Capsule())
            .task {
                withAnimation(.easeOut(duration: 0.7).delay(0.15)) { grown = true }
            }
    }
}

/// زحف بطيء على الصورة يمنح الصفحة الساكنة إحساس الفيلم.
private struct KenBurns: View {
    let url: URL?
    let active: Bool
    @State private var zoomed = false

    var body: some View {
        FullBleedImage(url: url)
            .scaleEffect(zoomed ? 1.08 : 1.0)
            .animation(.easeInOut(duration: 14), value: zoomed)
            .onAppear { if active { zoomed = true } }
    }
}
