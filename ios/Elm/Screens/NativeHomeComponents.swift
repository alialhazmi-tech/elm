import SwiftUI

struct NativeStoryActions: View {
    let story: StoryCard
    @Environment(LibraryStore.self) private var library
    var body: some View {
        HStack(spacing: 0) {
            Button { library.toggle(story) } label: {
                Image(systemName: library.contains(story) ? "bookmark.fill" : "bookmark").frame(width: 44, height: 44)
            }.accessibilityLabel(library.contains(story) ? "إزالة من المحفوظات" : "حفظ لوقت لاحق")
            ShareLink(item: URLConstants.publicURL(path: story.path)) {
                Image(systemName: "square.and.arrow.up").frame(width: 44, height: 44)
            }.accessibilityLabel("مشاركة المادة")
        }.font(.system(size: 17)).foregroundStyle(ElmTheme.navyInk).buttonStyle(.plain)
    }
}

/// An editorial cover: generous title, edge-to-edge photograph, quiet reader actions.
struct NativeHomeLead: View {
    let story: StoryCard
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NavigationLink { StoryDestination(seed: story) } label: {
                VStack(alignment: .leading, spacing: 14) {
                    StoryCategoryLabel(story: story)
                    Text(story.title).font(ElmFonts.display(size: 30, weight: .heavy, relativeTo: .title))
                        .foregroundStyle(ElmTheme.ink).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    if story.imageURL != nil {
                        Color.clear.aspectRatio(16 / 9, contentMode: .fit)
                            .overlay { RemoteImage(url: story.imageURL) }
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                    }
                    if !story.excerpt.isEmpty {
                        Text(story.excerpt).font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2).lineLimit(3).lineSpacing(4)
                    }
                }.contentShape(Rectangle())
            }.buttonStyle(.plain)
            HStack {
                NavigationLink { StoryDestination(seed: story) } label: {
                    Label("اقرأ القصة", systemImage: "arrow.left")
                        .font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.navyInk).frame(minHeight: 44)
                }
                Spacer()
                NativeStoryActions(story: story)
            }
        }
    }
}

struct NativeStoryRow: View {
    let story: StoryCard
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            NavigationLink { StoryDestination(seed: story) } label: {
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 8) {
                        StoryCategoryLabel(story: story)
                        Text(story.title).font(ElmFonts.text(.headline, weight: .semibold))
                            .foregroundStyle(ElmTheme.ink).fixedSize(horizontal: false, vertical: true)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    if story.imageURL != nil && !typeSize.isAccessibilitySize {
                        RemoteImage(url: story.imageURL, height: 90, maxPixel: 320).frame(width: 90)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }.contentShape(Rectangle())
            }.buttonStyle(.plain)
            HStack {
                Text(ElmFormat.readingLabel(story.readingMinutes)).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                Spacer()
                NativeStoryActions(story: story)
            }
            Divider()
        }
    }
}

struct NativeBriefEntry: View {
    let home: MobileHomePayload
    var body: some View {
        NavigationLink {
            ElmScreen(title: "موجز العلم", showBack: true, showTools: false) {
                HomeBriefCard(items: home.brief, presentation: home.presentation).padding(18)
            }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "text.alignright").font(.system(size: 22)).frame(width: 44, height: 44)
                    .background(ElmTheme.surface, in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("موجز العلم").font(ElmFonts.display(.headline, weight: .bold))
                    Text("\(home.brief.count) عناوين للقراءة أو الاستماع").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold))
            }.foregroundStyle(ElmTheme.ink).padding(14).background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 20))
        }.buttonStyle(.plain)
    }
}
