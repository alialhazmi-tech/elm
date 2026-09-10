import SwiftUI

/// زر «استمع للموجز» مع شريط الزمن والتوقيت وسطر «تم توليد الصوت عبر HUMAIN» —
/// نفس التسميات والحالات والنص المقروء كما في `summary-listen.tsx` على الويب.
struct SummaryListenView: View {
    let kind: SummaryAudioKind
    /// شكل مضغوط للشريط السفلي في القارئ: الزر وحده بعرض كامل.
    var compact = false
    private let audio = SummaryAudioStore.shared

    private var active: Bool { audio.isActive(kind) }
    private var current: Bool { audio.kind == kind }
    private var loading: Bool { active && audio.state == .loading }
    private var playing: Bool { active && audio.state == .playing }
    private var ready: Bool { active && audio.isReady }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { audio.toggle(kind) } label: {
                HStack(spacing: 12) {
                    Group {
                        if loading { ProgressView().tint(.white) }
                        else { Image(systemName: playing ? "pause.fill" : "play.fill") }
                    }
                    .foregroundStyle(.white)
                    .frame(width: compact ? 30 : 44, height: compact ? 30 : 44)
                    .background(ElmTheme.navy, in: Circle())
                    Text(label)
                        .font(ElmFonts.text(.subheadline, weight: .semibold))
                        .foregroundStyle(compact ? .white : ElmTheme.navyInk)
                    if compact { Spacer(minLength: 0) }
                }
                .frame(maxWidth: compact ? .infinity : nil, minHeight: compact ? 46 : 44)
                .padding(.horizontal, compact ? 10 : 0)
                .background(compact ? ElmTheme.navy : .clear, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(loading ? "إلغاء تجهيز الصوت" : playing ? "إيقاف الاستماع مؤقتًا" : "استمع للموجز")
            .accessibilityAddTraits(playing ? [.isButton, .isSelected] : .isButton)

            if ready && !compact { timeline }
            if loading && !compact {
                Text("يُجهّز الصوت عند أول استماع، ثم يُحفظ للاستماع التالي.")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            }
            if current, let error = audio.errorMessage, !compact {
                Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.danger)
            }
        }
    }

    private var label: String {
        if loading { return "جارٍ تجهيز الصوت…" }
        if playing { return "إيقاف مؤقت" }
        if current, audio.errorMessage != nil { return "إعادة المحاولة" }
        return "استمع للموجز"
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("الموجز الصوتي").font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.ink2)
                Spacer()
                Text("\(clock(audio.position)) / \(audio.duration > 0 ? clock(audio.duration) : "—:—")")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).monospacedDigit()
                    .environment(\.layoutDirection, .leftToRight)
            }
            Slider(value: Binding(get: { min(audio.position, max(audio.duration, 0.01)) }, set: { audio.seek(to: $0) }), in: 0...max(audio.duration, 0.01))
                .tint(ElmTheme.navy)
                .environment(\.layoutDirection, .leftToRight)
                .disabled(audio.duration <= 0)
                .accessibilityLabel("موضع الاستماع")
                .accessibilityValue("\(clock(audio.position)) من \(clock(audio.duration))")
            Text("تم توليد الصوت عبر HUMAIN").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
        }
    }

    private func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// شريط مصغّر للموجز الصوتي فوق شريط التبويب — يظهر في كل التبويبات ما دام الصوت جاريًا أو متوقفًا مؤقتًا.
struct SummaryMiniBar: View {
    private let audio = SummaryAudioStore.shared

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 11).fill(ElmTheme.navyDeep).frame(width: 44, height: 44)
                if audio.state == .loading { ProgressView().tint(ElmTheme.gold) }
                else { Image(systemName: "waveform").foregroundStyle(ElmTheme.gold) }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(audio.state == .loading ? "جارٍ تجهيز الصوت…" : "الموجز الصوتي")
                    .font(ElmFonts.text(.caption2, weight: .bold)).foregroundStyle(ElmTheme.ink2)
                Text(audio.kind?.title ?? "").font(ElmFonts.display(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink).lineLimit(1)
                if audio.duration > 0 {
                    Text("\(clock(audio.position)) / \(clock(audio.duration))")
                        .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).monospacedDigit()
                        .environment(\.layoutDirection, .leftToRight)
                }
            }
            Spacer(minLength: 4)
            if let kind = audio.kind, audio.state != .loading {
                Button { audio.toggle(kind) } label: {
                    Image(systemName: audio.state == .playing ? "pause.fill" : "play.fill").frame(width: 38, height: 38)
                }
                .accessibilityLabel(audio.state == .playing ? "إيقاف الاستماع مؤقتًا" : "متابعة الاستماع")
            }
            Button { audio.stop() } label: { Image(systemName: "xmark").frame(width: 34, height: 34) }
                .accessibilityLabel("إغلاق الموجز الصوتي")
        }
        .foregroundStyle(ElmTheme.ink)
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .accessibilityElement(children: .contain)
    }

    private func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
