import SwiftUI

struct AskMessage: Identifiable, Equatable {
    enum Role { case user, elm }
    let id = UUID()
    var role: Role
    var text: String
    var source: StoryCard?
}

/// محرك الإجابة: يبحث في أرشيف المحررين المخزَّن ولا يؤلّف نصًا من عنده.
/// إن لم يجد مادة، يقولها صراحة — «لا إجابة بلا مصدر».
@MainActor
@Observable
final class AskStore {
    var messages: [AskMessage] = []
    var draft = ""
    var thinking = false

    func ask(_ raw: String) {
        let question = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        messages.append(AskMessage(role: .user, text: question))
        draft = ""
        thinking = true

        Task {
            try? await Task.sleep(for: .milliseconds(450))
            let answer = Self.answer(for: question)
            messages.append(answer)
            thinking = false
        }
    }

    private static func answer(for question: String) -> AskMessage {
        let matches = rank(question)
        guard let best = matches.first else {
            return AskMessage(
                role: .elm,
                text: "لم أجد في أرشيف محررينا مادة تجيب عن هذا السؤال. جرّب صياغة أقرب لعناوين العلم، أو تصفّح السلاسل الثماني.",
                source: nil
            )
        }
        let body = best.excerpt.isEmpty
            ? ElmFormat.bodyParagraphs(best.body ?? "").first ?? best.title
            : best.excerpt
        return AskMessage(role: .elm, text: "من أرشيف محررينا: \(body)", source: best)
    }

    /// ترتيب بسيط: عدد كلمات السؤال الحاضرة في العنوان والموجز بعد التطبيع العربي.
    private static func rank(_ question: String) -> [StoryCard] {
        let words = ArabicNormalize.fold(question)
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
            .filter { $0.count > 2 }
        guard !words.isEmpty else { return [] }

        return HomeCorpus.cards()
            .map { card -> (StoryCard, Int) in
                let hay = ArabicNormalize.fold("\(card.title) \(card.excerpt) \(card.eyebrow) \(card.section)")
                let title = ArabicNormalize.fold(card.title)
                let score = words.reduce(0) { total, word in
                    total + (title.contains(word) ? 3 : 0) + (hay.contains(word) ? 1 : 0)
                }
                return (card, score)
            }
            .filter { $0.1 >= 2 }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }
}

/// 1e — اسأل العلم: كل إجابة تحمل بطاقة مصدر قابلة للنقر.
struct AskScreen: View {
    @State private var store = AskStore()
    @FocusState private var composerFocused: Bool

    private let suggestions = [
        "وش صار في مضيق هرمز؟",
        "لخّص لي موجز اليوم",
        "شائعات هذا الأسبوع",
    ]

    var body: some View {
        ElmScreen(title: "اسأل العلم", scrolls: false) {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            intro.padding(.top, 16)

                            ForEach(store.messages) { message in
                                bubble(message)
                            }

                            if store.thinking {
                                HStack(spacing: 6) {
                                    ProgressView().controlSize(.mini)
                                    Text("أبحث في الأرشيف…")
                                        .font(ElmFonts.text(.caption2))
                                        .foregroundStyle(ElmTheme.ink3)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            ElmFlow(spacing: 7) {
                                ForEach(suggestions, id: \.self) { item in
                                    Button { store.ask(item) } label: {
                                        Text(item)
                                            .font(ElmFonts.text(.footnote))
                                            .foregroundStyle(ElmTheme.ink2)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 7)
                                            .background(ElmTheme.surface, in: Capsule())
                                            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.top, 2)

                            Color.clear.frame(height: 1).id("askBottom")
                        }
                        .padding(.horizontal, 18)
                        .padding(.bottom, 12)
                    }
                    .onChange(of: store.messages.count) { _, _ in
                        withAnimation(.snappy) { proxy.scrollTo("askBottom", anchor: .bottom) }
                    }
                }

                composer
            }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Text("✦").foregroundStyle(ElmTheme.gold)
                    Text("اسأل العلم")
                }
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(ElmTheme.navyDeep, in: Capsule())

                Text("يجيب من أرشيف محررينا فقط")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                Spacer(minLength: 0)
            }
            Text("يتجاهل التشكيل واختلاف الهمزات — وكل إجابة تحيل إلى المادة التي جاءت منها.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(ElmTheme.spectrumGradient, lineWidth: 1.5)
        )
        .shadow(color: .black.opacity(0.06), radius: 14, y: 5)
    }

    @ViewBuilder
    private func bubble(_ message: AskMessage) -> some View {
        let isElm = message.role == .elm
        VStack(alignment: .leading, spacing: 0) {
            if isElm {
                Text("✦ العلم")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.ink3)
                    .padding(.bottom, 5)
            }
            Text(message.text)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(isElm ? ElmTheme.ink : .white)
                .multilineTextAlignment(.leading)
                .lineSpacing(5)

            if let source = message.source {
                NavigationLink {
                    StoryDestination(seed: source)
                } label: {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .fill(source.series.map(SeriesPalette.color(for:)) ?? ElmTheme.hex("eda313"))
                            .frame(width: 8, height: 8)
                        Text(sourceLabel(source))
                            .font(ElmFonts.text(.caption2))
                            .foregroundStyle(ElmTheme.ink2)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: "arrow.left")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(ElmTheme.ink3)
                    }
                    .padding(.horizontal, 11)
                    .padding(.vertical, 9)
                    .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.top, 10)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(isElm ? ElmTheme.surface : ElmTheme.navyDeep)
        .clipShape(bubbleShape(isElm))
        .overlay(bubbleShape(isElm).stroke(isElm ? ElmTheme.line : .clear, lineWidth: 1))
        .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
        // في RTL تعني `.leading` اليمين: إجابات العلم يمينًا وأسئلتك يسارًا كما في محادثات العربية.
        .frame(maxWidth: .infinity, alignment: isElm ? .leading : .trailing)
        .padding(isElm ? .trailing : .leading, 40)
    }

    private var composer: some View {
        HStack(spacing: 9) {
            HStack(spacing: 9) {
                Text("✦").foregroundStyle(SeriesPalette.color(for: "shakhsiat"))
                TextField("اسأل عن أي مادة في الأرشيف", text: $store.draft)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink)
                    .focused($composerFocused)
                    .submitLabel(.send)
                    .onSubmit { store.ask(store.draft) }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(ElmTheme.surface2, in: Capsule())
            .overlay(Capsule().stroke(ElmTheme.line2, lineWidth: 1))

            Button { store.ask(store.draft) } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background(ElmTheme.navyDeep, in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(store.draft.trimmingCharacters(in: .whitespaces).isEmpty)
            .opacity(store.draft.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
            .accessibilityLabel("إرسال السؤال")
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, composerFocused ? 12 : 78)
        .background {
            ElmTheme.glass
                .background(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
    }

    /// فقاعة بذيل صغير عند جهة المتحدث — UnevenRoundedRectangle يقلب leading/trailing مع RTL.
    private func bubbleShape(_ fromElm: Bool) -> UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: fromElm ? 5 : 16,
            bottomTrailingRadius: fromElm ? 16 : 5,
            topTrailingRadius: 16,
            style: .continuous
        )
    }

    private func sourceLabel(_ story: StoryCard) -> String {
        let series = story.series.flatMap { slug in SeriesPalette.active.first { $0.id == slug }?.name }
        return series.map { "\(story.title) · \($0)" } ?? story.title
    }
}
