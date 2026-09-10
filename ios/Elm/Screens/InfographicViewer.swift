import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// صورة الإنفوجرافيك داخل المادة: بعرض الشاشة كاملة بلا قصّ (`scaledToFit`)، والنقر يفتح المعاينة الكاملة.
/// `RemoteImage` تملأ وتقصّ (للبطاقات)؛ هنا الصورة هي المادة نفسها فلا تُقصّ.
struct InfographicFigure: View {
    let url: URL?
    let title: String
    @State private var image: UIImage?
    @State private var failed = false
    @State private var presented = false

    var body: some View {
        Button { if image != nil { presented = true } } label: {
            Group {
                if let image {
                    Image(uiImage: image).resizable().scaledToFit()
                } else {
                    Color.clear.aspectRatio(1, contentMode: .fit)
                        .background(LinearGradient(colors: [ElmTheme.navyDeep, ElmTheme.navy], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .overlay {
                            if failed {
                                Label("تعذر تحميل الإنفوجرافيك", systemImage: "photo").font(ElmFonts.text(.footnote)).foregroundStyle(.white.opacity(0.85))
                            } else {
                                ProgressView().tint(.white.opacity(0.65))
                            }
                        }
                }
            }
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                if image != nil {
                    Label("تكبير", systemImage: "arrow.up.left.and.arrow.down.right")
                        .font(ElmFonts.text(.caption2, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).frame(minHeight: 30)
                        .background(.black.opacity(0.55), in: Capsule())
                        .padding(10)
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("إنفوجرافيك: \(title)")
        .accessibilityHint("يفتح المعاينة الكاملة مع التكبير")
        .task(id: url) { await load() }
        .fullScreenCover(isPresented: $presented) {
            if let image { InfographicViewer(image: image, title: title).elmRTL() }
        }
    }

    private func load() async {
        guard let url else { failed = true; return }
        failed = false
        if let loaded = await ImageStore.shared.uiImage(url, maxPixel: 3000) { image = loaded }
        else { failed = true }
    }
}

/// معاينة ملء الشاشة بقرص للتكبير (حتى 5×) ونقر مزدوج، وسحب للتمرير — `UIScrollView` للسلوك الأصلي.
struct InfographicViewer: View {
    let image: UIImage
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            ZoomableImage(image: image).ignoresSafeArea()
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(.subheadline, weight: .semibold))
                        .foregroundStyle(.white).frame(width: 44, height: 44)
                        .background(.white.opacity(0.18), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("إغلاق المعاينة")
                Spacer(minLength: 0)
                Text("قرّب بإصبعين أو انقر مرتين").font(ElmFonts.text(.caption2)).foregroundStyle(.white.opacity(0.75))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
        .accessibilityLabel("إنفوجرافيك: \(title)")
        .statusBarHidden()
    }
}

private struct ZoomableImage: UIViewRepresentable {
    let image: UIImage

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.delegate = context.coordinator
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 5
        scroll.showsVerticalScrollIndicator = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.bouncesZoom = true
        scroll.backgroundColor = .black
        scroll.contentInsetAdjustmentBehavior = .never
        let view = UIImageView(image: image)
        view.contentMode = .scaleAspectFit
        view.isAccessibilityElement = false
        scroll.addSubview(view)
        context.coordinator.imageView = view
        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        scroll.addGestureRecognizer(doubleTap)
        return scroll
    }

    func updateUIView(_ scroll: UIScrollView, context: Context) {
        context.coordinator.layout(in: scroll)
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        var imageView: UIImageView?
        private var lastSize: CGSize = .zero

        func layout(in scroll: UIScrollView) {
            guard let imageView, scroll.bounds.size != lastSize, scroll.bounds.width > 0 else { return }
            lastSize = scroll.bounds.size
            scroll.zoomScale = 1
            imageView.frame = CGRect(origin: .zero, size: scroll.bounds.size)
            scroll.contentSize = scroll.bounds.size
            center(scroll)
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }
        func scrollViewDidZoom(_ scrollView: UIScrollView) { center(scrollView) }

        private func center(_ scroll: UIScrollView) {
            guard let imageView else { return }
            let dx = max(0, (scroll.bounds.width - scroll.contentSize.width) / 2)
            let dy = max(0, (scroll.bounds.height - scroll.contentSize.height) / 2)
            imageView.center = CGPoint(x: scroll.contentSize.width / 2 + dx, y: scroll.contentSize.height / 2 + dy)
        }

        @objc func doubleTapped(_ gesture: UITapGestureRecognizer) {
            guard let scroll = gesture.view as? UIScrollView else { return }
            if scroll.zoomScale > 1.01 {
                scroll.setZoomScale(1, animated: true)
            } else {
                let point = gesture.location(in: imageView)
                let size = CGSize(width: scroll.bounds.width / 2.5, height: scroll.bounds.height / 2.5)
                scroll.zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
            }
        }
    }
}
