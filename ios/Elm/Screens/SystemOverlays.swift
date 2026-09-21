import SwiftUI

struct OfflinePill: View {
    var body: some View {
        Label("بلا اتصال — تقرأ من النسخة المحفوظة", systemImage: "wifi.slash")
            .font(ElmFonts.text(.caption, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(ElmTheme.navyDeep.opacity(0.96))
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
            .accessibilityLabel("وضع بلا اتصال، تعرض النسخة المحفوظة")
    }
}

struct NarrationBar: View {
    @Environment(NarrationStore.self) private var narration

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 11).fill(ElmTheme.navyDeep).frame(width: 44, height: 44)
                Image(systemName: "waveform").foregroundStyle(ElmTheme.gold)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("يُقرأ الآن")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.ink2)
                Text(narration.title)
                    .font(ElmFonts.display(.caption, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Button { narration.toggle() } label: {
                Image(systemName: narration.state == .playing ? "pause.fill" : "play.fill")
                    .frame(width: 38, height: 38)
            }
            .accessibilityLabel(narration.state == .playing ? "إيقاف مؤقت" : "متابعة الاستماع")
            Button { narration.stop() } label: {
                Image(systemName: "xmark").frame(width: 34, height: 34)
            }
            .accessibilityLabel("إغلاق المشغل")
        }
        .padding(10)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusMd).stroke(ElmTheme.line))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 7)
        .padding(.horizontal, 12)
    }
}
