import AVFoundation
import Foundation
import MediaPlayer
import Observation

/// مصدر الموجز الصوتي — نظير `SummaryListen` على الويب: الموجز الصوتي للرئيسية (نص النشرة من
/// `home.brief`) أو موجز مادة (حقل `excerpt` وحده، لا المتن)، كلاهما يُولَّد على الخادم بصوت HUMAIN
/// عبر `POST /api/content/listen`. التطبيق لا يقرأ نصًا آخر ولا يولّد صوتًا محليًا لهذا الزر.
enum SummaryAudioKind: Equatable {
    case home
    case story(id: String, title: String)

    var key: String {
        switch self {
        case .home: "home"
        case .story(let id, _): "story:\(id)"
        }
    }

    var requestBody: Data {
        switch self {
        case .home: Data(#"{"kind":"home"}"#.utf8)
        case .story(let id, _): Data("{\"kind\":\"story\",\"storyId\":\"\(id)\"}".utf8)
        }
    }

    var title: String {
        switch self {
        case .home: "موجز العلم"
        case .story(_, let title): title
        }
    }
}

enum SummaryAudioState: Equatable {
    case idle, loading, playing, paused, finished
}

/// مشغّل واحد للموجز الصوتي في التطبيق كله: صوت واحد في كل لحظة، والحالة تنعكس على كل الأزرار.
@MainActor
@Observable
final class SummaryAudioStore: NSObject, AVAudioPlayerDelegate {
    static let shared = SummaryAudioStore()

    var kind: SummaryAudioKind?
    var state: SummaryAudioState = .idle
    var errorMessage: String?
    var position: Double = 0
    var duration: Double = 0

    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var ticker: Timer?
    /// الصوت المحمّل يُحفظ في الذاكرة للاستماع التالي كما يحتفظ الويب بـ`objectURL`.
    @ObservationIgnored private var cache: [String: Data] = [:]
    /// يُستدعى عند بدء التشغيل الفعلي لأول مرة (الويب يرسل حدث `listen` للأعضاء).
    @ObservationIgnored var onStarted: ((SummaryAudioKind) -> Void)?
    /// حالة الدخول تُقرأ لحظة التشغيل (تُضبط من `ElmApp`) — حدث `listen` للأعضاء فقط، مرة لكل مادة.
    @ObservationIgnored var isSignedIn: () -> Bool = { false }
    @ObservationIgnored private var listenSent: Set<String> = []
    @ObservationIgnored private var cacheOrder: [String] = []
    @ObservationIgnored private var interruptionObserver: NSObjectProtocol?

    var isReady: Bool { player != nil }

    @ObservationIgnored private var podcastObserver: NSObjectProtocol?

    override init() {
        super.init()
        // بدء حلقة بودكاست يُسكت الموجز — لا صوتان معًا.
        podcastObserver = NotificationCenter.default.addObserver(forName: .elmPodcastDidStart, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.stop() }
        }
        // مكالمة/سيري: إيقاف مؤقت صريح، واستئناف عند انتهاء المقاطعة إن أذن النظام (`shouldResume`).
        interruptionObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init(rawValue:)) ?? []
            Task { @MainActor in
                guard let self else { return }
                switch type {
                case .began:
                    if self.state == .playing { self.player?.pause(); self.stopTicker(); self.state = .paused; self.publishNowPlaying() }
                case .ended:
                    if self.state == .paused, options.contains(.shouldResume), let kind = self.kind { self.toggle(kind) }
                @unknown default: break
                }
            }
        }
        configureRemoteCommands()
    }

    func isActive(_ target: SummaryAudioKind) -> Bool { kind == target && state != .idle }

    /// نفس دورة زر الويب: تحميل → تشغيل، وضغطة أثناء التحميل تلغيه، وأثناء التشغيل توقفه مؤقتًا.
    func toggle(_ target: SummaryAudioKind) {
        if kind == target {
            switch state {
            case .loading:
                task?.cancel()
                task = nil
                state = .idle
                return
            case .playing:
                player?.pause()
                stopTicker()
                state = .paused
                publishNowPlaying()
                return
            case .paused, .finished:
                if let player {
                    if state == .finished { player.currentTime = 0 }
                    activateSession()
                    if player.play() { state = .playing; startTicker(); publishNowPlaying(); return }
                }
            case .idle:
                break
            }
        }
        start(target)
    }

    func stop() {
        task?.cancel()
        task = nil
        player?.stop()
        player = nil
        stopTicker()
        state = .idle
        kind = nil
        position = 0
        duration = 0
        errorMessage = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    // MARK: شاشة القفل ومركز التحكم

    private func publishNowPlaying() {
        guard let kind else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: kind.title,
            MPMediaItemPropertyArtist: "الموجز الصوتي — العلم",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
            MPNowPlayingInfoPropertyPlaybackRate: state == .playing ? 1.0 : 0.0,
        ]
        info[MPNowPlayingInfoPropertyMediaType] = MPNowPlayingInfoMediaType.audio.rawValue
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            guard let self, let kind = self.kind, self.state == .paused || self.state == .finished else { return .noActionableNowPlayingItem }
            self.toggle(kind)
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            guard let self, let kind = self.kind, self.state == .playing else { return .noActionableNowPlayingItem }
            self.toggle(kind)
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self, let kind = self.kind, self.state != .idle, self.state != .loading else { return .noActionableNowPlayingItem }
            self.toggle(kind)
            return .success
        }
    }

    /// إيقاف الموجز عند مغادرة شاشته — كما يتوقف `<audio>` على الويب عند مغادرة الصفحة.
    func stopIfCurrent(_ target: SummaryAudioKind) {
        if kind == target { stop() }
    }

    func seek(to seconds: Double) {
        guard let player else { return }
        player.currentTime = max(0, min(seconds, player.duration))
        position = player.currentTime
        if state == .finished { state = .paused }
    }

    private func start(_ target: SummaryAudioKind) {
        stop()
        kind = target
        state = .loading
        errorMessage = nil
        NotificationCenter.default.post(name: .elmSummaryAudioDidStart, object: nil)
        PodcastPlayerStore.shared.pause()
        task = Task { [weak self] in
            guard let self else { return }
            do {
                let data = try await self.load(target)
                try Task.checkCancellation()
                let audio = try AVAudioPlayer(data: data)
                audio.delegate = self
                self.activateSession()
                guard audio.prepareToPlay(), audio.play() else { throw ElmAPIError.server(0, "تعذر تشغيل الصوت.") }
                self.player = audio
                self.duration = audio.duration
                self.position = 0
                self.state = .playing
                self.startTicker()
                self.publishNowPlaying()
                self.onStarted?(target)
                // كما الويب: حدث `listen` للأعضاء عند أول تشغيل فعلي لموجز المادة.
                if case .story(let id, _) = target, self.isSignedIn(), !self.listenSent.contains(id) {
                    self.listenSent.insert(id)
                    Task.detached(priority: .utility) { try? await APIClient.sendEvents([["type": "listen", "storyId": id]]) }
                }
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled, self.kind == target else { return }
                // نبقي `kind` حتى يظهر الخطأ بجوار الزر الذي ضُغط، كما يبقى نص الخطأ تحت زر الويب.
                self.state = .idle
                self.errorMessage = (error as? ElmAPIError)?.message ?? "تعذر تجهيز الصوت الآن. حاول مرة أخرى بعد قليل."
            }
        }
    }

    private func load(_ target: SummaryAudioKind) async throws -> Data {
        if let cached = cache[target.key] { return cached }
        var request = URLRequest(url: URLConstants.contentAPI.appending(path: "api/content/listen"))
        request.httpMethod = "POST"
        request.timeoutInterval = 115
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(URLConstants.contentAPI.absoluteString, forHTTPHeaderField: "Origin")
        request.httpBody = target.requestBody
        let (data, response) = try await ElmHTTP.session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ElmAPIError.decoding }
        guard http.statusCode == 200 else { throw ElmAPIError.from(status: http.statusCode, data: data) }
        guard http.mimeType == "audio/wav" else { throw ElmAPIError.server(http.statusCode, "تعذر تحميل الصوت.") }
        // كاش محدود: آخر أربعة موجزات (~1–4MB لكل منها) بدل قاموس غير محدود طوال الجلسة.
        cache[target.key] = data
        cacheOrder.removeAll { $0 == target.key }
        cacheOrder.append(target.key)
        while cacheOrder.count > 4, let oldest = cacheOrder.first { cache.removeValue(forKey: oldest); cacheOrder.removeFirst() }
        return data
    }

    private func activateSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [])
        try? session.setActive(true)
    }

    private func startTicker() {
        stopTicker()
        ticker = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, let player = self.player else { return }
                self.position = player.currentTime
                self.duration = player.duration
            }
        }
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.stopTicker()
            self.position = self.duration
            self.state = .finished
        }
    }
}

extension Notification.Name {
    /// يُبثّ عند بدء تحميل/تشغيل موجز صوتي حتى تصمت القراءة المحلية والبودكاست.
    static let elmSummaryAudioDidStart = Notification.Name("elm.summaryAudio.didStart")
}
