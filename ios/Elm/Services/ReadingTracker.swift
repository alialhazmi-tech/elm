import Foundation
import Observation

/// إشارات القراءة لمادة واحدة: `article_open` للعضو عند الفتح، ونبضة `/api/content/reading`
/// كل 15 ثانية قراءة نشطة وعند الإغلاق (للزائر والعضو)، و`listen` عند بدء الاستماع.
/// لا يحجب الواجهة أبدًا: الأخطاء تُبتلع، وإعادة المحاولة مرة واحدة عند الإغلاق فقط.
@MainActor
@Observable
final class ReadingTracker {
    @ObservationIgnored private let sessionId = UUID().uuidString.lowercased()
    @ObservationIgnored private var storyId: String?
    @ObservationIgnored private var activeSince: Date?
    @ObservationIgnored private var accumulatedMs = 0
    @ObservationIgnored private var maxProgress = 0
    @ObservationIgnored private var lastSentMs = -1
    @ObservationIgnored private var lastSentProgress = -1
    @ObservationIgnored private var heartbeat: Task<Void, Never>?
    @ObservationIgnored private var openedFor: String?
    @ObservationIgnored private var listenedFor: String?
    @ObservationIgnored private var finished = false
    /// كما على الويب: `reading_progress` للعضو عند علامات 25/50/75/90 وكل 15 ثانية نشطة وعند المغادرة.
    @ObservationIgnored private var signedIn = false
    @ObservationIgnored private var sentMarks: Set<Int> = []
    @ObservationIgnored private var lastMemberFlushMs = 0
    /// `accepted:false` من `/api/content/reading` (التخصيص متوقف) يوقف النبض العام لهذه الجلسة.
    @ObservationIgnored private var publicAccepted = true

    private var activeMs: Int {
        accumulatedMs + (activeSince.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0)
    }

    /// يُستدعى عند ظهور المادة؛ يبدأ العدّ ويُرسل `article_open` للعضو مرة واحدة.
    func begin(storyId: String, signedIn: Bool) {
        self.signedIn = signedIn
        if self.storyId != storyId {
            self.storyId = storyId
            accumulatedMs = 0
            maxProgress = 0
            lastSentMs = -1
            lastSentProgress = -1
            sentMarks = []
            lastMemberFlushMs = 0
            publicAccepted = true
        }
        // العودة إلى المادة بعد دفع مادة مرتبطة فوقها تستأنف الجلسة نفسها.
        finished = false
        resume()
        if signedIn, openedFor != storyId {
            openedFor = storyId
            Task.detached(priority: .utility) {
                try? await APIClient.sendEvents([["type": "article_open", "storyId": storyId]])
            }
        }
        heartbeat?.cancel()
        heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled else { return }
                await self?.flush(final: false)
            }
        }
    }

    func update(progress: Double) {
        let percent = max(0, min(100, Int((progress * 100).rounded())))
        if percent > maxProgress { maxProgress = percent }
        guard signedIn, let storyId else { return }
        for mark in [25, 50, 75, 90] where maxProgress >= mark && !sentMarks.contains(mark) {
            sentMarks.insert(mark)
            sendProgress(storyId: storyId, final: false)
        }
    }

    /// `reading_progress` بمدة القراءة النشطة منذ آخر إرسال (الخادم يقصّها عند 30 ثانية كما الويب).
    private func sendProgress(storyId: String, final: Bool) {
        let total = activeMs
        let duration = max(0, total - lastMemberFlushMs)
        guard final || duration >= 400 else { return }
        lastMemberFlushMs = total
        let value = maxProgress
        Task.detached(priority: .utility) {
            try? await APIClient.sendEvents([["type": "reading_progress", "storyId": storyId, "durationMs": min(30_000, duration), "value": value]])
        }
    }

    /// عند مغادرة التطبيق للخلفية أو تغطية القارئ: يوقف العدّ دون إنهاء الجلسة.
    func pause() {
        guard let activeSince else { return }
        accumulatedMs += Int(Date().timeIntervalSince(activeSince) * 1000)
        self.activeSince = nil
    }

    func resume() {
        guard !finished, activeSince == nil else { return }
        activeSince = Date()
    }

    func listened(signedIn: Bool) {
        guard signedIn, let storyId, listenedFor != storyId else { return }
        listenedFor = storyId
        Task.detached(priority: .utility) {
            try? await APIClient.sendEvents([["type": "listen", "storyId": storyId]])
        }
    }

    /// عند الإغلاق: نبضة أخيرة بمحاولتين على الأكثر.
    func end() {
        heartbeat?.cancel()
        heartbeat = nil
        pause()
        finished = true
        Task { await flush(final: true) }
    }

    private func flush(final: Bool) async {
        guard let storyId else { return }
        if signedIn { sendProgress(storyId: storyId, final: final) }
        guard publicAccepted else { return }
        let ms = min(7_200_000, activeMs)
        let progress = maxProgress
        // لا نبضة بلا تغيّر ولا نبضة لأقل من ثانية قراءة.
        guard ms >= 1000, ms != lastSentMs || progress != lastSentProgress else { return }
        lastSentMs = ms
        lastSentProgress = progress
        let sessionId = sessionId
        Task.detached(priority: .utility) { [weak self] in
            do {
                let accepted = try await APIClient.sendReading(storyId: storyId, sessionId: sessionId, activeMs: ms, progress: progress)
                if accepted == false { await MainActor.run { self?.publicAccepted = false } }
            } catch {
                guard final else { return }
                try? await Task.sleep(for: .seconds(2))
                try? await APIClient.sendReading(storyId: storyId, sessionId: sessionId, activeMs: ms, progress: progress)
            }
        }
    }
}
