import SwiftUI

/// 1k — الترحيب واختيار الاهتمامات. وضعان بحدود الويب:
/// - `.onboarding` (`/welcome`): من 3 إلى 7، غطاء كامل، والاقتراحات لا تُضاف تلقائيًا والزر معطّل قبل الثلاثة.
/// - `.account` («اهتماماتي» في الحساب): حتى 12، تُدفع من شاشة الحساب وتعود عند الحفظ.
struct OnboardingScreen: View {
    enum Mode { case onboarding, account }
    var mode: Mode = .onboarding

    @Environment(InterestStore.self) private var interests
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(MemberSessionStore.self) private var member
    @Environment(\.dismiss) private var dismiss

    private var minimum: Int { mode == .onboarding ? InterestCatalog.onboardingMinimum : 0 }
    private var maximum: Int { mode == .onboarding ? InterestCatalog.onboardingMaximum : InterestCatalog.accountMaximum }

    private var count: Int { interests.selected.count }
    private var ready: Bool { count >= minimum }

    private var suggestions: [InterestItem] {
        guard count > 0, count < maximum else { return [] }
        return InterestCatalog.all.filter { !interests.selected.contains($0.id) }.prefix(3).map { $0 }
    }

    var body: some View {
        Group {
            if mode == .account {
                ElmScreen(title: "اهتماماتي", showBack: true, scrolls: false) { content }
            } else {
                content.background(ElmTheme.bg.ignoresSafeArea())
            }
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
                        ForEach(InterestCatalog.all) { item in
                            card(item)
                        }
                    }

                    if !suggestions.isEmpty {
                        suggestionBox.padding(.top, 16)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 20)
            }

            footer
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            if mode == .onboarding {
                Text(member.isSignedIn ? "أهلًا يا \(member.firstName)" : "أهلًا بك في العلم")
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
                Text("وش تحب تعرف أكثر؟")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .padding(.top, 5)
                Text("اختر من \(ElmFormat.latinDigits("3")) إلى \(ElmFormat.latinDigits("7")) اهتمامات. أنت تتحكم بما يعرفه العلم عن اهتماماتك، ويمكنك تعديلها متى شئت.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(4)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 7)
            } else {
                Text("اهتماماتي")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text("اختر حتى \(ElmFormat.latinDigits("12")) اهتمامًا. تُحفظ في حسابك وتُرتّب «لك أنت» على أساسها.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(4)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 16)
    }

    private func card(_ item: InterestItem) -> some View {
        let on = interests.selected.contains(item.id)
        return Button {
            guard on || count < maximum else { return }
            interests.toggle(item.id)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    Text(on ? "✓" : "+")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 22, height: 22)
                        .background(ElmTheme.hex(item.color), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    Text(item.label)
                        .font(ElmFonts.display(.subheadline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                }
                Text(item.description)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(2)
                    .padding(.top, 6)
            }
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
            .padding(13)
            .background(on ? ElmTheme.surface2 : ElmTheme.surface, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(on ? ElmTheme.ink : ElmTheme.line, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .opacity(!on && count >= maximum ? 0.5 : 1)
        .accessibilityLabel("\(item.label)، \(item.description)")
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    }

    private var suggestionBox: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("بناءً على اختياراتك، قد يعجبك أيضًا")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
            ElmFlow(spacing: 7) {
                ForEach(suggestions) { item in
                    Button { interests.toggle(item.id) } label: {
                        Text("+ \(item.label)")
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(ElmTheme.surface, in: Capsule())
                            .overlay(Capsule().stroke(ElmTheme.line2, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
            Text("اقتراحات آلية خفيفة، ولا نضيف شيئًا دون اختيارك.")
                .font(ElmFonts.text(.caption2))
                .foregroundStyle(ElmTheme.ink3)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }

    private var footer: some View {
        HStack(spacing: 12) {
            Text(interests.syncError ?? counterLabel)
                .font(ElmFonts.text(.caption))
                .foregroundStyle(ready ? ElmTheme.ink2 : ElmTheme.ink3)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(interests.syncError == nil ? 0 : 1)
            Button {
                Task {
                    guard await interests.save() else { return }
                    if mode == .onboarding { onboarding.complete() } else { dismiss() }
                }
            } label: {
                Text(buttonLabel)
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(ready ? .white : ElmTheme.ink3)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(ready ? ElmTheme.navyDeep : ElmTheme.line2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!ready || interests.syncing)
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, mode == .account ? 96 : 8)
        .background {
            ElmTheme.glass
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
    }

    /// الويب: «N اهتمامات مختارة» في الحساب؛ والتهيئة تعرض العدد المختار.
    private var counterLabel: String {
        mode == .account ? "\(ElmFormat.latinDigits(String(count))) اهتمامات مختارة" : "\(ElmFormat.latinDigits(String(count))) مختارة"
    }

    private var buttonLabel: String {
        if interests.syncing { return "جارٍ الحفظ…" }
        if mode == .account { return "حفظ الاهتمامات" }
        return ready ? "تأكيد اهتماماتي" : "اختر \(ElmFormat.latinDigits(String(minimum - count))) على الأقل"
    }
}
