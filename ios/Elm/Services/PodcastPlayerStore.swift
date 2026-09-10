import AVFoundation
import Foundation
import MediaPlayer
import Observation

extension Notification.Name {
    /// يُبثّ عند بدء حلقة بودكاست حتى يصمت المشغّل النصي.
    static let elmPodcastDidStart = Notification.Name("net.alelm.podcast.didStart")
}

enum PodcastPlaybackState: Equatable {
    case idle, loading, playing, paused
}

/// مشغّل حلقات البودكاست — مفرد لأن `ElmApp` خارج نطاق هذا التسليم ولا يمكن حقنه في البيئة.
/// AVPlayer + جلسة تشغيل خلفية + مركز «يُشغَّل الآن» وأوامر شاشة القفل.
@MainActor
@Observable
final class PodcastPlayerStore {
    static let shared = PodcastPlayerStore()

    @ObservationIgnored private var player: AVPlayer?
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var endObserver: NSObjectProtocol?
    @ObservationIgnored private var statusObservation: NSKeyValueObservation?
    @ObservationIgnored private var interruptionObserver: NSObjectProtocol?
    @ObservationIgnored private var commandsConfigured = false

    var state: PodcastPlaybackState = .idle
    var episode: PodcastEpisode?
    var show: PodcastShow?
    var currentTime: Double = 0
    var duration: Double = 0
    var errorMessage: String?

    var isActive: Bool { episode != nil }
    var progress: Double { duration > 0 ? min(1, max(0, currentTime / duration)) : 0 }

    private init() {
        interruptionObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
            Task { @MainActor in self?.pause() }
        }
    }

    func isCurrent(_ item: PodcastEpisode) -> Bool { episode?.id == item.id }

    func play(_ item: PodcastEpisode, from show: PodcastShow) {
        if isCurrent(item) {
            toggle()
            return
        }
        guard let url = item.audioURL else {
            errorMessage = "رابط الحلقة غير صالح."
            return
        }
        tearDownPlayer()
        errorMessage = nil
        episode = item
        self.show = show
        currentTime = 0
        duration = Double(seconds(of: item.duration))
        state = .loading

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
            try session.setActive(true)
        } catch {
            // فشل الجلسة لا يمنع التشغيل داخل التطبيق؛ يفقد فقط الخلفية.
        }
        NotificationCenter.default.post(name: .elmPodcastDidStart, object: nil)

        let playerItem = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: playerItem)
        player.automaticallyWaitsToMinimizeStalling = true
        self.player = player

        statusObservation = playerItem.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self else { return }
                switch item.status {
                case .readyToPlay:
                    let seconds = item.duration.seconds
                    if seconds.isFinite, seconds > 0 { self.duration = seconds }
                    if self.state == .loading { self.state = .playing }
                    self.publishNowPlaying()
                case .failed:
                    self.state = .idle
                    self.errorMessage = "تعذر تشغيل الحلقة. تحقق من الاتصال وحاول مجددًا."
                default: break
                }
            }
        }
        endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: playerItem, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.state = .paused
                self.currentTime = self.duration
                self.publishNowPlaying()
            }
        }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 1, preferredTimescale: 10), queue: .main) { [weak self] time in
            Task { @MainActor in
                guard let self else { return }
                let seconds = time.seconds
                if seconds.isFinite { self.currentTime = seconds }
            }
        }
        configureRemoteCommands()
        player.play()
        publishNowPlaying()
    }

    func toggle() {
        switch state {
        case .playing: pause()
        case .paused: resume()
        case .loading, .idle: break
        }
    }

    func pause() {
        guard state == .playing else { return }
        player?.pause()
        state = .paused
        publishNowPlaying()
    }

    func resume() {
        guard let player, state == .paused else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        if duration > 0, currentTime >= duration - 1 { player.seek(to: .zero); currentTime = 0 }
        player.play()
        state = .playing
        NotificationCenter.default.post(name: .elmPodcastDidStart, object: nil)
        publishNowPlaying()
    }

    func seek(to seconds: Double) {
        guard let player else { return }
        let target = max(0, min(duration > 0 ? duration : seconds, seconds))
        currentTime = target
        player.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        publishNowPlaying()
    }

    func skip(_ delta: Double) { seek(to: currentTime + delta) }

    func stop() {
        tearDownPlayer()
        episode = nil
        show = nil
        state = .idle
        currentTime = 0
        duration = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: داخلي

    private func seconds(of raw: String?) -> Int {
        guard let raw = raw.map(ElmFormat.latinDigits) else { return 0 }
        if raw.contains(":") { return raw.split(separator: ":").compactMap { Int($0) }.reduce(0) { $0 * 60 + $1 } }
        return Int(Double(raw) ?? 0)
    }

    private func tearDownPlayer() {
        if let timeObserver, let player { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
        statusObservation?.invalidate()
        statusObservation = nil
        player?.pause()
        player = nil
    }

    private func configureRemoteCommands() {
        guard !commandsConfigured else { return }
        commandsConfigured = true
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.resume() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.toggle() }
            return .success
        }
        center.skipForwardCommand.preferredIntervals = [15]
        center.skipForwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.skip(15) }
            return .success
        }
        center.skipBackwardCommand.preferredIntervals = [15]
        center.skipBackwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.skip(-15) }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor in self?.seek(to: event.positionTime) }
            return .success
        }
    }

    private func publishNowPlaying() {
        guard let episode else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: episode.title,
            MPMediaItemPropertyArtist: show?.name ?? "بودكاست العلم",
            MPMediaItemPropertyAlbumTitle: "العلم",
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: state == .playing ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        if let cover = show?.coverURL {
            Task.detached(priority: .utility) { [cover] in
                guard let image = await ImageStore.shared.uiImage(cover) else { return }
                await MainActor.run {
                    var current = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    current[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = current
                }
            }
        }
    }
}
