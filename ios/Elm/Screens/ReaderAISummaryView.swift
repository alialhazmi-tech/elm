import SwiftUI

/// «لخّص لي» — نظير أداة الويب: للأعضاء عبر `POST /api/me/ai {tool:"summary"}`، والزائر يُدعى للانضمام.
/// النص من الخادم ثلاث نقاط مرقّمة؛ لا ملخص محلي.
struct ReaderAISummaryView: View {
    let storyId: String
    @Environment(MemberSessionStore.self) private var member
    @State private var open = false
    @State private var loading = false
    @State private var result: APIClient.ReaderToolResult?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                if !member.isSignedIn { member.authPresented = true; return }
                open.toggle()
                if open, result == nil, !loading { Task { await run() } }
            } label: {
                HStack(spacing: 8) {
                    Text("✦").foregroundStyle(ElmTheme.gold)
                    Text("لخّص لي")
                    if loading { ProgressView().padding(.leading, 4) }
                    Spacer(minLength: 0)
                    if member.isSignedIn { Image(systemName: open ? "chevron.up" : "chevron.down").font(.system(size: 11, weight: .semibold)) }
                    else { Text("للأعضاء").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                }
                .font(ElmFonts.text(.footnote, weight: .semibold))
                .foregroundStyle(ElmTheme.ink)
                .padding(.horizontal, 14).frame(minHeight: 44)
                .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(member.isSignedIn ? "لخّص لي — ملخص ذكي للمادة" : "لخّص لي — يتطلب تسجيل الدخول")

            if open {
                if let result {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ملخص ذكي — يُولَّد من المادة نفسها ولا يستبدل قراءتها.")
                            .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                        if let points = result.points, !points.isEmpty {
                            ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text("\(ElmFormat.latinDigits(String(index + 1))).").font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.navyInk)
                                    Text(point).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                                }
                            }
                        } else {
                            Text(result.text).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink).lineSpacing(3)
                        }
                    }
                    .padding(12)
                    .background(ElmTheme.surface2.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else if let error {
                    HStack {
                        Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.danger)
                        Spacer()
                        Button("إعادة المحاولة") { Task { await run() } }.font(ElmFonts.text(.caption, weight: .semibold))
                    }
                }
            }
        }
    }

    private func run() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            result = try await APIClient.readerTool("summary", storyId: storyId)
        } catch {
            let api = ElmAPIError.wrap(error)
            if api.isUnauthorized { member.user = nil; open = false; member.authPresented = true }
            else { self.error = api.message }
        }
    }
}
