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

    private var activeMs: Int {
        accumulatedMs + (activeSince.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0)
    }

    /// يُستدعى عند ظهور المادة؛ يبدأ العدّ ويُرسل `article_open` للعضو مرة واحدة.
    func begin(storyId: String, signedIn: Bool) {
        if self.storyId != storyId {
            self.storyId = storyId
            accumulatedMs = 0
            maxProgress = 0
            lastSentMs = -1
            lastSentProgress = -1
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
        let ms = min(7_200_000, activeMs)
        let progress = maxProgress
        // لا نبضة بلا تغيّر ولا نبضة لأقل من ثانية قراءة.
        guard ms >= 1000, ms != lastSentMs || progress != lastSentProgress else { return }
        lastSentMs = ms
        lastSentProgress = progress
        let sessionId = sessionId
        Task.detached(priority: .utility) {
            do {
                try await APIClient.sendReading(storyId: storyId, sessionId: sessionId, activeMs: ms, progress: progress)
            } catch {
                guard final else { return }
                try? await Task.sleep(for: .seconds(2))
                try? await APIClient.sendReading(storyId: storyId, sessionId: sessionId, activeMs: ms, progress: progress)
            }
        }
    }
}
