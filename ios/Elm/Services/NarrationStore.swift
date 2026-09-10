import AVFoundation
import Foundation
import Observation

enum NarrationState: Equatable {
    case idle, playing, paused
}

@MainActor
@Observable
final class NarrationStore: NSObject, AVSpeechSynthesizerDelegate {
    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()

    var state: NarrationState = .idle
    var title = ""
    var storyId: String?

    @ObservationIgnored private var podcastObserver: NSObjectProtocol?
    @ObservationIgnored private var summaryObserver: NSObjectProtocol?
    @ObservationIgnored private var interruptionObserver: NSObjectProtocol?

    override init() {
        super.init()
        synthesizer.delegate = self
        // بدء حلقة بودكاست يُسكت القراءة الصوتية — لا صوتان معًا.
        // مقاطعة نظامية: تحديث الحالة إلى «متوقف مؤقتًا» حتى لا يبقى الزر «إيقاف مؤقت» بعد المكالمة.
        interruptionObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
            Task { @MainActor in
                guard let self, self.state == .playing else { return }
                if self.synthesizer.pauseSpeaking(at: .word) { self.state = .paused } else { self.state = .paused }
            }
        }
        summaryObserver = NotificationCenter.default.addObserver(forName: .elmSummaryAudioDidStart, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.state != .idle else { return }
                self.stop()
            }
        }
        podcastObserver = NotificationCenter.default.addObserver(forName: .elmPodcastDidStart, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.state != .idle else { return }
                self.stop()
            }
        }
    }

    /// جلسة تشغيل حتى يستمر الصوت مع مفتاح الصمت وقفل الشاشة.
    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [])
        try? session.setActive(true)
    }

    func start(story: StoryCard, paragraphs: [String]) {
        synthesizer.stopSpeaking(at: .immediate)
        PodcastPlayerStore.shared.pause()
        SummaryAudioStore.shared.stop()
        activateAudioSession()
        title = story.title
        storyId = story.apiId
        let body = ([story.title, story.excerpt] + paragraphs).filter { !$0.isEmpty }.joined(separator: ". ")
        let utterance = AVSpeechUtterance(string: body)
        utterance.voice = AVSpeechSynthesisVoice(language: "ar-SA")
        utterance.rate = 0.46
        utterance.pitchMultiplier = 1.0
        synthesizer.speak(utterance)
        state = .playing
    }

    func toggle() {
        switch state {
        case .playing:
            if synthesizer.pauseSpeaking(at: .word) { state = .paused }
        case .paused:
            activateAudioSession()
            PodcastPlayerStore.shared.pause()
            if synthesizer.continueSpeaking() { state = .playing }
        case .idle:
            break
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        state = .idle
        storyId = nil
        title = ""
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.stop() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.state = .idle
            self.storyId = nil
            self.title = ""
        }
    }
}
