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
        if compact { compactButton } else { fullControl }
    }

    /// زر مضغوط لرأس المادة: كبسولة كحلية بارتفاع 36 وعرض المحتوى؛ الشريط الزمني يظهر أسفل الشاشة أثناء التشغيل.
    private var compactButton: some View {
        Button { audio.toggle(kind) } label: {
            HStack(spacing: 7) {
                Group {
                    if loading { ProgressView().tint(.white).controlSize(.small) }
                    else { Image(systemName: playing ? "pause.fill" : "play.fill").font(.system(size: 11, weight: .bold)) }
                }
                .frame(width: 14, height: 14)
                Text(label).font(ElmFonts.text(.caption, weight: .bold)).fixedSize()
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14).frame(minHeight: 36)
            .background(ElmTheme.navy, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(loading ? "إلغاء تجهيز الصوت" : playing ? "إيقاف الاستماع مؤقتًا" : "استمع للموجز")
        .accessibilityAddTraits(playing ? [.isButton, .isSelected] : .isButton)
    }

    private var fullControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { audio.toggle(kind) } label: {
                HStack(spacing: 12) {
                    Group {
                        if loading { ProgressView().tint(.white) }
                        else { Image(systemName: playing ? "pause.fill" : "play.fill") }
                    }
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(ElmTheme.navy, in: Circle())
                    Text(label)
                        .font(ElmFonts.text(.subheadline, weight: .semibold))
                        .foregroundStyle(ElmTheme.navyInk)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(loading ? "إلغاء تجهيز الصوت" : playing ? "إيقاف الاستماع مؤقتًا" : "استمع للموجز")
            .accessibilityAddTraits(playing ? [.isButton, .isSelected] : .isButton)

            if ready { timeline }
            if loading {
                Text("يُجهّز الصوت عند أول استماع، ثم يُحفظ للاستماع التالي.")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            }
            if current, let error = audio.errorMessage {
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

/// شريط الموجز الصوتي أسفل القارئ — يظهر أثناء التجهيز والتشغيل فقط، بنفس تسميات الويب
/// (الشريط الزمني، التوقيت، ونسبة «تم توليد الصوت عبر HUMAIN»).
struct ReaderAudioBar: View {
    let kind: SummaryAudioKind
    private let audio = SummaryAudioStore.shared

    private var loading: Bool { audio.state == .loading }
    private var playing: Bool { audio.state == .playing }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                Button { audio.toggle(kind) } label: {
                    Group {
                        if loading { ProgressView().tint(.white) }
                        else { Image(systemName: playing ? "pause.fill" : "play.fill").font(.system(size: 15, weight: .bold)) }
                    }
                    .foregroundStyle(.white).frame(width: 40, height: 40).background(ElmTheme.navy, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(loading ? "إلغاء تجهيز الصوت" : playing ? "إيقاف مؤقت" : "متابعة الاستماع")
                VStack(alignment: .leading, spacing: 2) {
                    Text(loading ? "جارٍ تجهيز الصوت…" : "الموجز الصوتي")
                        .font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink)
                    Text(loading ? "يُجهّز عند أول استماع ثم يُحفظ للمرة التالية" : "تم توليد الصوت عبر HUMAIN")
                        .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).lineLimit(1)
                }
                Spacer(minLength: 4)
                if audio.duration > 0 {
                    Text("\(clock(audio.position)) / \(clock(audio.duration))")
                        .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).monospacedDigit()
                        .environment(\.layoutDirection, .leftToRight)
                        .accessibilityLabel("\(clock(audio.position)) من \(clock(audio.duration))")
                }
                Button { audio.stop() } label: {
                    Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(ElmTheme.ink2)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("إغلاق الموجز الصوتي")
            }
            if audio.isReady {
                Slider(value: Binding(get: { min(audio.position, max(audio.duration, 0.01)) }, set: { audio.seek(to: $0) }), in: 0...max(audio.duration, 0.01))
                    .tint(ElmTheme.navy)
                    .environment(\.layoutDirection, .leftToRight)
                    .disabled(audio.duration <= 0)
                    .accessibilityLabel("موضع الاستماع")
                    .accessibilityValue("\(clock(audio.position)) من \(clock(audio.duration))")
            }
            if let error = audio.errorMessage {
                Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 18).padding(.top, 10).padding(.bottom, 8)
        .background { ElmTheme.glass.ignoresSafeArea(edges: .bottom) }
        .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
        .accessibilityElement(children: .contain)
    }

    private func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
