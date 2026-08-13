import SwiftUI

struct OnboardingScreen: View {
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(InterestStore.self) private var interests
    @State private var step = 0
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ZStack {
            ElmTheme.bg.ignoresSafeArea()
            ambientBackground
            VStack(spacing: 0) {
                topBar
                TabView(selection: $step) {
                    welcome.tag(0)
                    interestChoice.tag(1)
                    ready.tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.snappy, value: step)
                progress
            }
        }
        .interactiveDismissDisabled()
    }

    private var topBar: some View {
        HStack {
            Text("العلم")
                .font(ElmFonts.logo(.title2))
                .foregroundStyle(ElmTheme.ink)
            Spacer()
            if step < 2 {
                Button("تخطي") { onboarding.complete() }
                    .font(ElmFonts.text(.subheadline, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink2)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
    }

    private var welcome: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Spacer(minLength: 18)
                ZStack {
                    RoundedRectangle(cornerRadius: 34, style: .continuous)
                        .fill(ElmTheme.navyDeep)
                        .frame(width: 84, height: 84)
                        .shadow(color: ElmTheme.navyDeep.opacity(0.22), radius: 24, y: 14)
                    Text("ع")
                        .font(ElmFonts.logo(.largeTitle))
                        .foregroundStyle(ElmTheme.gold)
                }
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 12) {
                    Text("المعرفة كما يجب أن تُروى.")
                        .font(ElmFonts.display(.title2, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    Text("سياق الخبر وأرقامه ولماذا يهمك.")
                        .font(ElmFonts.text(.body, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                }

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) {
                        promise("نقرأ أقل", icon: "text.book.closed")
                        promise("نفهم أكثر", icon: "sparkles")
                        promise("نحفظ ما يهم", icon: "bookmark")
                    }
                    VStack(spacing: 8) {
                        promiseRow("نقرأ أقل", icon: "text.book.closed")
                        promiseRow("نفهم أكثر", icon: "sparkles")
                        promiseRow("نحفظ ما يهم", icon: "bookmark")
                    }
                }

                Button {
                    step = 1
                } label: {
                    Label("ابنِ تجربتك", systemImage: "arrow.left")
                        .font(ElmFonts.text(.headline, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(ElmTheme.navyDeep)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                }
                .accessibilityHint("ينقلك لاختيار الاهتمامات")
            }
            .padding(20)
        }
    }

    private var interestChoice: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("خطوتك الأولى")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.accent)
                    Text("ما الذي يستحق وقتك؟")
                        .font(ElmFonts.display(.title2, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text("اختر ثلاثة على الأقل. تستطيع تعديلها متى شئت.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: dynamicTypeSize.isAccessibilitySize ? 250 : 150), spacing: 10)], spacing: 10) {
                    ForEach(InterestCatalog.all) { item in
                        InterestChoiceCard(item: item, selected: interests.selected.contains(item.id)) {
                            interests.toggle(item.id)
                        }
                    }
                }

                Button {
                    step = 2
                } label: {
                    HStack {
                        Text("متابعة")
                        Spacer()
                        Text("\(ElmFormat.latinDigits(String(interests.items.count))) مختارة")
                            .font(ElmFonts.text(.caption, weight: .bold))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(.white.opacity(0.14))
                            .clipShape(Capsule())
                    }
                    .font(ElmFonts.text(.headline, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(16)
                    .background(interests.items.count >= 3 ? ElmTheme.navyDeep : ElmTheme.ink3)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                }
                .disabled(interests.items.count < 3)
            }
            .padding(18)
        }
    }

    private var ready: some View {
        ScrollView {
            VStack(spacing: 22) {
                Spacer(minLength: 70)
                ZStack {
                    Circle().stroke(ElmTheme.line, lineWidth: 1).frame(width: 118, height: 118)
                    Circle().fill(ElmTheme.navyDeep).frame(width: 94, height: 94)
                    Image(systemName: "checkmark")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(ElmTheme.gold)
                }
                Text("صار العلم أقرب إليك.")
                    .font(ElmFonts.display(.title2, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.center)
                Text("سنوازن بين اهتماماتك وما يستحق أن تعرفه، ولن نحول صفحتك إلى فقاعة مغلقة.")
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink2)
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)

                FlowTags(items: interests.items)

                Button {
                    onboarding.complete()
                } label: {
                    Text("افتح العلم")
                        .font(ElmFonts.text(.headline, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(ElmTheme.navyDeep)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                }
            }
            .padding(20)
        }
    }

    private var progress: some View {
        HStack(spacing: 7) {
            ForEach(0..<3, id: \.self) { index in
                Capsule()
                    .fill(index == step ? ElmTheme.navy : ElmTheme.line2)
                    .frame(width: index == step ? 30 : 8, height: 5)
            }
        }
        .padding(.vertical, 14)
        .animation(.snappy, value: step)
        .accessibilityLabel("الخطوة \(step + 1) من 3")
    }

    private var ambientBackground: some View {
        GeometryReader { proxy in
            Circle()
                .fill(SeriesPalette.color(for: "limatha").opacity(0.11))
                .frame(width: proxy.size.width * 0.9)
                .blur(radius: 45)
                .offset(x: proxy.size.width * 0.35, y: -70)
            Circle()
                .fill(SeriesPalette.color(for: "shakhsiat").opacity(0.08))
                .frame(width: proxy.size.width * 0.8)
                .blur(radius: 55)
                .offset(x: -proxy.size.width * 0.35, y: proxy.size.height * 0.58)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func promise(_ title: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.headline).foregroundStyle(ElmTheme.accent)
            Text(title)
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusSm).stroke(ElmTheme.line))
    }

    private func promiseRow(_ title: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.headline).foregroundStyle(ElmTheme.accent).frame(width: 28)
            Text(title).font(ElmFonts.text(.body, weight: .bold)).foregroundStyle(ElmTheme.ink)
            Spacer()
        }
        .padding(13)
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm))
        .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusSm).stroke(ElmTheme.line))
    }
}

struct InterestChoiceCard: View {
    let item: InterestItem
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle().fill(ElmTheme.hex(item.color)).frame(width: 10, height: 10)
                    Spacer()
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(selected ? ElmTheme.hex(item.color) : ElmTheme.ink3)
                }
                Spacer(minLength: 6)
                Text(item.label)
                    .font(ElmFonts.display(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(item.description)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineLimit(2)
            }
            .padding(13)
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .background(selected ? ElmTheme.hex(item.color).opacity(0.10) : ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusMd).stroke(selected ? ElmTheme.hex(item.color) : ElmTheme.line, lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.label)
        .accessibilityValue(selected ? "مختار" : "غير مختار")
    }
}

private struct FlowTags: View {
    let items: [InterestItem]
    var body: some View {
        VStack(spacing: 8) {
            ForEach(Array(items.chunked(into: 3).enumerated()), id: \.offset) { _, row in
                HStack(spacing: 7) {
                    ForEach(row) { item in
                        Text(item.label)
                            .font(ElmFonts.text(.caption, weight: .bold))
                            .foregroundStyle(ElmTheme.hex(item.color))
                            .padding(.horizontal, 11)
                            .padding(.vertical, 6)
                            .background(ElmTheme.hex(item.color).opacity(0.10))
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
    }
}
