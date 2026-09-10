import SwiftUI

/// Confirmed server state only; local legacy votes are never imported as real votes.
struct ArticleInteractionView: View {
    let storyId: String
    @Environment(MemberSessionStore.self) private var member
    @State private var state: APIClient.ArticleInteraction?
    @State private var loading = false
    @State private var saving = false
    @State private var error: String?
    private let options = ["نعم، أضافت لي سياقًا جديدًا", "كنت أعرف أغلب ما فيها"]
    private var identity: String { "\(storyId):\(member.user?.id ?? "guest")" }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button { Task { await save(liked: !(state?.liked ?? false)) } } label: {
                Label(saving ? "جارٍ الحفظ…" : state?.liked == true ? "أعجبتني" : "أعجبني", systemImage: state?.liked == true ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 44)
            }.disabled(state == nil || saving || loading)
            Divider()
            Text("سؤال الختام — هل غيّرت هذه المادة فهمك للموضوع؟")
                .font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink)
            ForEach(options.indices, id: \.self) { index in
                let total = state?.counts.reduce(0, +) ?? 0
                let count = (state?.counts.indices.contains(index) == true) ? state!.counts[index] : 0
                let pct = total > 0 ? Int((Double(count) / Double(total) * 100).rounded()) : 0
                let chosen = state?.closingAnswer
                Button { Task { await save(answer: index) } } label: {
                    HStack(spacing: 10) {
                        Text("\(chosen == index ? "✓ " : "")\(options[index])").font(ElmFonts.text(.body))
                        Spacer(minLength: 0)
                        if chosen != nil, total > 0 {
                            Text("\(ElmFormat.latinDigits(String(pct)))%").font(ElmFonts.text(.caption, weight: .bold)).monospacedDigit()
                        }
                    }
                    .foregroundStyle(ElmTheme.ink).padding(14).frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                    // شريط النسبة كما على الويب (`.poll-opt .fill`) — يظهر بعد الإجابة فقط.
                    .background {
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 14).fill(chosen == index ? ElmTheme.surface3 : ElmTheme.surface)
                            if chosen != nil, total > 0 {
                                GeometryReader { proxy in
                                    RoundedRectangle(cornerRadius: 14).fill(ElmTheme.navyInk.opacity(0.12)).frame(width: proxy.size.width * CGFloat(pct) / 100)
                                }
                            }
                        }
                    }
                }.buttonStyle(.plain).disabled(state == nil || saving || loading)
                    .accessibilityAddTraits(chosen == index ? .isSelected : [])
                    .accessibilityValue(chosen != nil && total > 0 ? "\(ElmFormat.latinDigits(String(pct))) بالمئة" : "")
            }
            // نص الحالة كما في `poll.tsx` على الويب حرفيًا.
            if let error {
                Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                Button("إعادة تحميل التفاعل") { Task { await reload() } }.frame(minHeight: 44).disabled(loading || saving)
            } else {
                Text(pollNote).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            }
        }.padding(18).background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 20))
        .task { await reload() }
    }

    private var pollNote: String {
        if saving { return "جارٍ حفظ إجابتك…" }
        guard let state else { return "جارٍ تحميل السؤال…" }
        if state.closingAnswer != nil {
            return "تم حفظ إجابتك · \(ElmFormat.latinDigits(String(state.counts.reduce(0, +)))) إجابة مسجّلة. يمكنك تغيير اختيارك دون إضافة صوت آخر."
        }
        return "متاح للجميع. تُحتسب إجابة واحدة لكل حساب، أو متصفح للزائر."
    }

    @MainActor private func reload() async {
        guard !loading && !saving else { return }
        let account = identity
        loading = true
        error = nil
        defer { loading = false }
        do {
            let result = try await APIClient.fetchInteraction(storyId: storyId)
            guard account == identity, !Task.isCancelled else { return }
            state = result
        } catch { if account == identity && !Task.isCancelled { self.error = "تعذر تحميل التفاعل. أعد المحاولة." } }
    }

    @MainActor private func save(liked: Bool? = nil, answer: Int? = nil) async {
        guard !saving && !loading, state != nil else { return }
        let account = identity
        saving = true
        error = nil
        defer { saving = false }
        do {
            let result = try await APIClient.saveInteraction(storyId: storyId, liked: liked, answer: answer)
            guard account == identity else { return }
            state = result
        } catch {
            if account == identity { self.error = "لم نتمكن من تأكيد الحفظ. أعد المحاولة؛ لن يُحتسب التفاعل مرتين." }
        }
    }
}
