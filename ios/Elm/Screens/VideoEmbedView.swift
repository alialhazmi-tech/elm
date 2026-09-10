import SwiftUI
import WebKit

/// مشغّل مضمّن للفيديو (يوتيوب / X / إنستقرام) داخل صفحة HTML دنيا بلا تنقل خارجي،
/// مع زر احتياطي يفتح المصدر الأصلي. الحاوية ثابتة النسبة بنمط `Color.clear.aspectRatio`.
struct VideoEmbedView: View {
    let embedURL: URL
    var originalURL: URL?
    var kind: String?

    @State private var failed = false
    @State private var safariPresented = false

    private var ratio: CGFloat {
        switch kind {
        case "youtube": 16 / 9
        case "instagram": 4 / 5
        default: 1
        }
    }

    private var sourceLabel: String {
        switch kind {
        case "youtube": "يوتيوب"
        case "x": "منصة X"
        case "instagram": "إنستقرام"
        default: "المصدر"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Color.clear
                .aspectRatio(ratio, contentMode: .fit)
                .overlay {
                    if failed {
                        VStack(spacing: 10) {
                            Image(systemName: "play.slash").font(.system(.largeTitle, weight: .light))
                            Text("تعذر تحميل المشغّل هنا.").font(ElmFonts.text(.footnote))
                        }
                        .foregroundStyle(.white.opacity(0.85))
                    } else {
                        EmbedWebView(url: embedURL, failed: $failed)
                    }
                }
                .background(Color.black)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityLabel("فيديو مضمّن من \(sourceLabel)")

            if let originalURL {
                Button { safariPresented = true } label: {
                    Label("افتح على \(sourceLabel)", systemImage: "arrow.up.left.square")
                        .font(ElmFonts.text(.footnote, weight: .semibold))
                        .foregroundStyle(ElmTheme.navyInk)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .sheet(isPresented: $safariPresented) {
                    SafariSheet(url: originalURL).ignoresSafeArea()
                }
            }
        }
    }
}

private struct EmbedWebView: UIViewRepresentable {
    let url: URL
    @Binding var failed: Bool

    func makeCoordinator() -> Coordinator { Coordinator(failed: $failed) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.navigationDelegate = context.coordinator
        web.accessibilityIgnoresInvertColors = true
        web.loadHTMLString(Self.page(for: url), baseURL: URLConstants.publicSite)
        return web
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    /// صفحة دنيا: الإطار يملأ الحاوية، `dir=rtl` للنصوص الملحقة، وبلا هوامش.
    private static func page(for url: URL) -> String {
        let src = url.absoluteString
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
        return """
        <!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
        iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
        <body><iframe src="\(src)" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen playsinline referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
        """
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var failed: Bool
        init(failed: Binding<Bool>) { _failed = failed }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed = true }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed = true }

        /// أي تنقّل خارج الإطار (نقر على شعار المنصة) يُفتح في المتصفح لا داخل الحاوية.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.targetFrame?.isMainFrame == true, action.navigationType == .linkActivated, let url = action.request.url {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
