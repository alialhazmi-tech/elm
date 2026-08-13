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

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func start(story: StoryCard, paragraphs: [String]) {
        synthesizer.stopSpeaking(at: .immediate)
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
