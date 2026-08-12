import SwiftUI

struct RemoteImage: View {
    let url: URL?
    var height: CGFloat? = nil
    var minHeight: CGFloat? = nil

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        placeholder
                    default:
                        placeholder.overlay { ProgressView().tint(.white.opacity(0.7)) }
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .frame(minHeight: minHeight)
        .clipped()
        .background(ElmTheme.navyDeep)
    }

    private var placeholder: some View {
        LinearGradient(
            colors: [ElmTheme.navyDeep, ElmTheme.navy],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
