import SwiftUI

/// 1c — الموجز كقصص عمودية: تقدّم تلقائي، ضغط للإيقاف، سحب لأسفل للإغلاق.
struct StoriesScreen: View {
    let items: [BriefItem]

    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var progress: Double = 0
    @State private var paused = false
    @State private var dragOffset: CGFloat = 0
    @State private var openStory: StoryCard?

    private let slideSeconds: Double = 6
    private let tick = Timer.publish(every: 0.04, on: .main, in: .common).autoconnect()

    private var slides: [BriefItem] { Array(items.prefix(5)) }
    private var current: BriefItem? { slides.indices.contains(index) ? slides[index] : nil }

    var body: some View {
        ZStack {
            Color(red: 0.02, green: 0.063, blue: 0.122).ignoresSafeArea()

            if let card = matchedCard, card.imageURL != nil {
                // الصور الليلية تختفي عند 0.55 كما في نموذج الويب — والتدرّج وحده
                // يكفي لقراءة النص، فتُرفع الشفافية حتى تبقى الصورة خلفية فعلية.
                FullBleedImage(url: card.imageURL)
                    .opacity(0.85)
                    .ignoresSafeArea()
                    .id(card.id)
                    .transition(.opacity)
            }

            LinearGradient(
                stops: [
                    .init(color: Color(red: 0.02, green: 0.063, blue: 0.122).opacity(0.75), location: 0),
                    .init(color: Color(red: 0.02, green: 0.063, blue: 0.122).opacity(0.15), location: 0.38),
                    .init(color: Color(red: 0.02, green: 0.063, blue: 0.122).opacity(0.92), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            content
        }
        .offset(y: dragOffset)
        .gesture(dismissGesture)
        .onTapGesture { paused.toggle() }
        .onReceive(tick) { _ in advanceIfNeeded() }
        .navigationDestinationCompat(item: $openStory)
        .statusBarHidden()
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
                ForEach(slides.indices, id: \.self) { slot in
                    Capsule()
                        .fill(.white.opacity(0.28))
                        .frame(height: 3)
                        .overlay(alignment: .leading) {
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(.white)
                                    .frame(width: proxy.size.width * fill(for: slot))
                            }
                        }
                }
            }
            .padding(.top, 14)
            .accessibilityHidden(true)

            HStack(spacing: 9) {
                Text("العلم")
                    .font(ElmFonts.logo(.headline))
                    .foregroundStyle(.white)
                Text("موجز اليوم · \(ElmFormat.latinDigits("\(index + 1)/\(max(slides.count, 1))"))")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer(minLength: 0)
                if paused {
                    Image(systemName: "pause.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white.opacity(0.8))
                        .accessibilityLabel("متوقف")
                }
            }
            .padding(.top, 14)

            Spacer(minLength: 20)

            if let current {
                SeriesChipLabel(name: current.label, color: ElmTheme.hex(current.color), onDark: true)
                Text(current.title)
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 12)
                if let dek = matchedCard?.excerpt, !dek.isEmpty {
                    Text(dek)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(.white.opacity(0.82))
                        .multilineTextAlignment(.leading)
                        .lineSpacing(4)
                        .padding(.top, 10)
                }
            }

            HStack(spacing: 10) {
                Button {
                    openStory = matchedCard ?? current.map(Self.card(from:))
                } label: {
                    Text("اقرأ المادة كاملة")
                        .font(ElmFonts.text(.footnote, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(.white.opacity(0.25), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 46, height: 46)
                        .background(.white.opacity(0.16), in: Circle())
                        .overlay(Circle().stroke(.white.opacity(0.25), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("إغلاق القصص")
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var dismissGesture: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                if value.translation.height > 0 { dragOffset = value.translation.height }
            }
            .onEnded { value in
                if value.translation.height > 110 {
                    dismiss()
                } else if value.translation.width > 60 {
                    // في RTL السحب لليمين يرجع للشريحة السابقة.
                    step(-1)
                    dragOffset = 0
                } else if value.translation.width < -60 {
                    step(1)
                    dragOffset = 0
                } else {
                    withAnimation(.snappy) { dragOffset = 0 }
                }
            }
    }

    private func fill(for slot: Int) -> CGFloat {
        if slot < index { return 1 }
        if slot > index { return 0 }
        return CGFloat(progress)
    }

    private func advanceIfNeeded() {
        guard !paused, !slides.isEmpty, openStory == nil else { return }
        progress += 0.04 / slideSeconds
        if progress >= 1 { step(1) }
    }

    private func step(_ delta: Int) {
        let next = index + delta
        if next < 0 {
            progress = 0
            return
        }
        if next >= slides.count {
            dismiss()
            return
        }
        withAnimation(.easeInOut(duration: 0.2)) { index = next }
        progress = 0
    }

    /// الموجز يحمل عنوانًا ورابطًا فقط — الصورة والموجز يأتيان من حزمة الرئيسية المخزّنة.
    /// المطابقة بالمسار قد تفشل حين يختلف شكل الرابط، فنُتبعها بالمعرّف ثم بالعنوان.
    private var matchedCard: StoryCard? {
        guard let current else { return nil }
        let cards = HomeCorpus.cards()
        let id = Self.apiId(current.href)
        if let hit = cards.first(where: { $0.path == current.href || $0.apiId == id }) { return hit }
        let title = ArabicNormalize.fold(current.title)
        return cards.first { ArabicNormalize.fold($0.title) == title }
    }

    nonisolated private static func apiId(_ href: String) -> String {
        let parts = href.split(separator: "/").map(String.init).filter { !$0.isEmpty }
        return parts.count >= 2 ? parts[1] : href
    }

    nonisolated private static func card(from item: BriefItem) -> StoryCard {
        StoryCard(
            id: item.href, slug: item.href, section: "news",
            title: item.title, excerpt: "", eyebrow: item.label, href: item.href
        )
    }
}

private extension View {
    /// القصص تُعرض كغطاء كامل بلا مكدس تنقل — فتُفتح المادة كغطاء بدوره.
    func navigationDestinationCompat(item: Binding<StoryCard?>) -> some View {
        fullScreenCover(item: item) { story in
            NavigationStack {
                StoryDestination(seed: story)
            }
            .elmRTL()
        }
    }
}
