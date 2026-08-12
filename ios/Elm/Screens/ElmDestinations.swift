import SwiftUI

extension View {
    func elmDestinations() -> some View {
        self
            .navigationDestination(for: StoryCard.self) { story in
                StoryDetailScreen(seed: story)
            }
            .navigationDestination(for: SeriesChip.self) { chip in
                SeriesFeedScreen(chip: chip)
            }
    }
}
