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
                Label(state?.liked == true ? "أعجبتني" : "أعجبني", systemImage: state?.liked == true ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .font(ElmFonts.text(.body, weight: .semibold)).frame(minHeight: 44)
            }.disabled(state == nil || saving || loading)
            Divider()
            Text("هل غيّرت هذه المادة فهمك للموضوع؟")
                .font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink)
            ForEach(options.indices, id: \.self) { index in
                Button { Task { await save(answer: index) } } label: {
                    HStack(spacing: 10) {
                        Text(options[index]).font(ElmFonts.text(.body))
                        Spacer(minLength: 0)
                        if state?.closingAnswer == index { Image(systemName: "checkmark.circle.fill") }
                        if let state, state.closingAnswer != nil, state.counts.reduce(0, +) > 0 {
                            let count = state.counts.indices.contains(index) ? state.counts[index] : 0
                            Text("\(Int((Double(count) / Double(state.counts.reduce(0, +)) * 100).rounded()))%")
                                .font(ElmFonts.text(.caption, weight: .bold))
                        }
                    }.foregroundStyle(ElmTheme.ink).padding(14).frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .background(state?.closingAnswer == index ? ElmTheme.surface3 : ElmTheme.surface, in: RoundedRectangle(cornerRadius: 14))
                }.buttonStyle(.plain).disabled(state == nil || saving || loading)
                    .accessibilityAddTraits(state?.closingAnswer == index ? .isSelected : [])
            }
            if loading || saving { ProgressView(saving ? "جارٍ حفظ إجابتك" : "جارٍ تحميل التفاعل") }
            if let error {
                Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                Button("إعادة تحميل التفاعل") { Task { await reload() } }.frame(minHeight: 44).disabled(loading || saving)
            } else if let state, state.closingAnswer != nil {
                Text("تم حفظ إجابتك. \(state.counts.reduce(0, +)) إجابة مسجلة؛ يمكنك تغيير اختيارك.")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            }
        }.padding(18).background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 20))
        .task { await reload() }
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
