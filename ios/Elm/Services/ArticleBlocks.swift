import Foundation
import SwiftUI

/// جزء نصي داخل بلوك مع تنسيقه الداخلي.
struct ArticleRun: Codable, Hashable, Sendable {
    var text: String
    var bold: Bool?
    var italic: Bool?
    var underline: Bool?
    var strike: Bool?
    var href: String?
}

/// بلوك متن المادة — يطابق `lib/mobile/blocks.ts` على الخادم، ويُبنى محليًا من HTML عند غيابه.
struct ArticleBlock: Codable, Hashable, Identifiable, Sendable {
    var type: String
    var runs: [ArticleRun]?
    var level: Int?
    var align: String?
    var ordered: Bool?
    var items: [[ArticleRun]]?
    var postId: String?

    var id: String {
        let text = (runs ?? []).map(\.text).joined() + (items ?? []).flatMap { $0 }.map(\.text).joined()
        return "\(type)-\(level ?? 0)-\(text.hashValue)"
    }

    var plainText: String {
        if let items { return items.map { $0.map(\.text).joined() }.joined(separator: "\n") }
        return (runs ?? []).map(\.text).joined()
    }
}

/// محلّل HTML المنقّى إلى بلوكات — نسخة محلية مطابقة لسلوك الخادم، تُستخدم عند غياب `blocks`
/// (خادم أقدم، كاش قديم، أو معاينة مسودة داخل اللوحة).
enum ArticleBlocks {
    private static let blockTags: Set<String> = ["p", "h2", "h3", "ul", "ol", "li", "blockquote"]
    private static let tokenPattern = try! NSRegularExpression(pattern: #"<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^"'>]|"[^"]*"|'[^']*')*)\/?>"#)

    static func parse(html raw: String) -> [ArticleBlock] {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return [] }
        guard text.range(of: #"<(p|h2|h3|ul|ol|li|blockquote|strong|em|u|s|a|br)\b"#, options: [.regularExpression, .caseInsensitive]) != nil else {
            return text.components(separatedBy: "\n\n")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .map { ArticleBlock(type: "paragraph", runs: [ArticleRun(text: $0.replacingOccurrences(of: "\n", with: "\n"))]) }
        }

        var blocks: [ArticleBlock] = []
        var runs: [ArticleRun] = []
        var listItems: [[ArticleRun]] = []
        var inList = false
        var listOrdered = false
        var current = "paragraph"
        var level: Int?
        var align: String?
        var postId: String?
        var bold = 0, italic = 0, underline = 0, strike = 0
        var href: String?

        func flushRuns() -> [ArticleRun] {
            var merged: [ArticleRun] = []
            for run in runs where !run.text.isEmpty {
                if var last = merged.last, last.bold == run.bold, last.italic == run.italic, last.underline == run.underline, last.strike == run.strike, last.href == run.href {
                    last.text += run.text
                    merged[merged.count - 1] = last
                } else {
                    merged.append(run)
                }
            }
            runs = []
            let joined = merged.map(\.text).joined().trimmingCharacters(in: .whitespacesAndNewlines)
            return joined.isEmpty ? [] : trimEdges(merged)
        }

        func closeBlock() {
            let content = flushRuns()
            if inList, current == "li" {
                if !content.isEmpty { listItems.append(content) }
                current = "paragraph"
                return
            }
            guard !content.isEmpty else { level = nil; align = nil; postId = nil; return }
            switch current {
            case "heading": blocks.append(ArticleBlock(type: "heading", runs: content, level: level ?? 2))
            case "quote": blocks.append(ArticleBlock(type: postId == nil ? "quote" : "xpost", runs: content, postId: postId))
            default: blocks.append(ArticleBlock(type: "paragraph", runs: content, align: align))
            }
            current = "paragraph"
            level = nil
            align = nil
            postId = nil
        }

        func appendText(_ piece: String) {
            let decoded = decodeEntities(piece)
            guard !decoded.isEmpty else { return }
            runs.append(ArticleRun(text: decoded, bold: bold > 0 ? true : nil, italic: italic > 0 ? true : nil, underline: underline > 0 ? true : nil, strike: strike > 0 ? true : nil, href: href))
        }

        let ns = text as NSString
        var cursor = 0
        for match in tokenPattern.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            appendText(ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor)))
            cursor = match.range.location + match.range.length
            let whole = ns.substring(with: match.range)
            let tag = ns.substring(with: match.range(at: 1)).lowercased()
            let attrs = match.range(at: 2).location == NSNotFound ? "" : ns.substring(with: match.range(at: 2))
            let closing = whole.hasPrefix("</")
            switch tag {
            case "br": runs.append(ArticleRun(text: "\n"))
            case "strong", "b": bold += closing ? -1 : 1; bold = max(0, bold)
            case "em", "i": italic += closing ? -1 : 1; italic = max(0, italic)
            case "u": underline += closing ? -1 : 1; underline = max(0, underline)
            case "s", "del", "strike": strike += closing ? -1 : 1; strike = max(0, strike)
            case "a":
                if closing { href = nil } else { href = attribute("href", in: attrs) }
            case "p", "div":
                closeBlock()
                if !closing { current = "paragraph"; align = alignment(in: attrs) }
            case "h1", "h2", "h3", "h4":
                closeBlock()
                if !closing { current = "heading"; level = tag == "h3" || tag == "h4" ? 3 : 2; align = alignment(in: attrs) }
            case "blockquote":
                closeBlock()
                if !closing { current = "quote"; postId = attribute("data-x-post", in: attrs) }
            case "ul", "ol":
                closeBlock()
                if closing {
                    if inList, !listItems.isEmpty { blocks.append(ArticleBlock(type: "list", ordered: listOrdered, items: listItems)) }
                    inList = false
                    listItems = []
                } else {
                    inList = true
                    listOrdered = tag == "ol"
                    listItems = []
                }
            case "li":
                closeBlock()
                if !closing { current = "li" }
            default: break
            }
        }
        appendText(ns.substring(from: cursor))
        closeBlock()
        if inList, !listItems.isEmpty { blocks.append(ArticleBlock(type: "list", ordered: listOrdered, items: listItems)) }
        return blocks
    }

    private static func trimEdges(_ runs: [ArticleRun]) -> [ArticleRun] {
        var result = runs
        if var first = result.first {
            first.text = String(first.text.drop { $0.isWhitespace || $0.isNewline })
            result[0] = first
        }
        if var last = result.last {
            while let end = last.text.last, end.isWhitespace || end.isNewline { last.text.removeLast() }
            result[result.count - 1] = last
        }
        return result.filter { !$0.text.isEmpty }
    }

    private static func attribute(_ name: String, in attrs: String) -> String? {
        let pattern = try! NSRegularExpression(pattern: "\(name)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", options: .caseInsensitive)
        let ns = attrs as NSString
        guard let match = pattern.firstMatch(in: attrs, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let range = match.range(at: 1).location != NSNotFound ? match.range(at: 1) : match.range(at: 2)
        return decodeEntities(ns.substring(with: range))
    }

    private static func alignment(in attrs: String) -> String? {
        guard let match = attrs.range(of: #"text-align\s*:\s*(center|left|justify)"#, options: [.regularExpression, .caseInsensitive]) else { return nil }
        let value = String(attrs[match]).lowercased()
        if value.contains("center") { return "center" }
        if value.contains("justify") { return "justify" }
        return "left"
    }

    static func decodeEntities(_ input: String) -> String {
        guard input.contains("&") else { return input }
        let named: [String: String] = ["&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&hellip;": "…", "&ndash;": "–", "&mdash;": "—", "&laquo;": "«", "&raquo;": "»"]
        var output = input
        for (entity, value) in named { output = output.replacingOccurrences(of: entity, with: value) }
        let numeric = try! NSRegularExpression(pattern: "&#(x?)([0-9a-fA-F]+);")
        let ns = output as NSString
        var result = ""
        var cursor = 0
        for match in numeric.matches(in: output, range: NSRange(location: 0, length: ns.length)) {
            result += ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
            let hex = ns.substring(with: match.range(at: 1)) == "x"
            let digits = ns.substring(with: match.range(at: 2))
            if let code = UInt32(digits, radix: hex ? 16 : 10), let scalar = Unicode.Scalar(code) {
                result += String(Character(scalar))
            }
            cursor = match.range.location + match.range.length
        }
        result += ns.substring(from: cursor)
        return result
    }

    /// نص خام للمشغّل الصوتي وعدّ الكلمات.
    static func paragraphs(_ blocks: [ArticleBlock]) -> [String] {
        blocks.map(\.plainText).map { ElmFormat.latinDigits($0) }.filter { !$0.isEmpty }
    }
}

/// عرض البلوكات بخطوط القراءة وروابط قابلة للنقر داخل النص.
struct ArticleBodyView: View {
    let blocks: [ArticleBlock]
    var fontSize: CGFloat = 17
    var accent: Color = ElmTheme.accent

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(blocks) { block in
                blockView(block)
                    .frame(maxWidth: .infinity, alignment: block.align == "center" ? .center : .leading)
            }
        }
    }

    @ViewBuilder
    private func blockView(_ block: ArticleBlock) -> some View {
        switch block.type {
        case "heading":
            Text(attributed(block.runs ?? [], base: ElmFonts.display(size: block.level == 3 ? fontSize + 2 : fontSize + 5, weight: .bold, relativeTo: .title3)))
                .foregroundStyle(ElmTheme.ink)
                .lineSpacing(4)
                .padding(.top, 6)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
        case "list":
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(block.ordered == true ? "\(ElmFormat.latinDigits(String(index + 1)))." : "•")
                            .font(ElmFonts.text(size: fontSize, weight: .bold, relativeTo: .body))
                            .foregroundStyle(accent)
                            .frame(minWidth: 18, alignment: .leading)
                        Text(attributed(item, base: ElmFonts.text(size: fontSize, relativeTo: .body)))
                            .foregroundStyle(ElmTheme.ink)
                            .lineSpacing(5)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.leading, 4)
        case "quote", "xpost":
            HStack(alignment: .top, spacing: 12) {
                RoundedRectangle(cornerRadius: 2).fill(accent).frame(width: 3)
                VStack(alignment: .leading, spacing: 8) {
                    Text(attributed(block.runs ?? [], base: ElmFonts.text(size: fontSize, weight: .medium, relativeTo: .body)))
                        .foregroundStyle(ElmTheme.ink)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                    if block.type == "xpost", let post = block.postId, let url = URL(string: "https://x.com/i/status/\(post)") {
                        Link(destination: url) {
                            Label("عرض المنشور على X", systemImage: "arrow.up.left.square")
                                .font(ElmFonts.text(.caption, weight: .semibold))
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        default:
            Text(attributed(block.runs ?? [], base: ElmFonts.text(size: fontSize, relativeTo: .body)))
                .foregroundStyle(ElmTheme.ink)
                .lineSpacing(5)
                .multilineTextAlignment(block.align == "center" ? .center : (block.align == "justify" ? .leading : .leading))
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
        }
    }

    private func attributed(_ runs: [ArticleRun], base: Font) -> AttributedString {
        var output = AttributedString()
        for run in runs {
            var piece = AttributedString(ElmFormat.latinDigits(run.text))
            piece.font = base
            if run.bold == true { piece.font = base.weight(.bold) }
            if run.italic == true { piece.font = (piece.font ?? base).italic() }
            if run.underline == true { piece.underlineStyle = .single }
            if run.strike == true { piece.strikethroughStyle = .single }
            if let href = run.href, let url = URL(string: href.hasPrefix("/") ? URLConstants.publicURL(path: href).absoluteString : href) {
                piece.link = url
                piece.foregroundColor = accent
                piece.underlineStyle = .single
            }
            output.append(piece)
        }
        return output
    }
}
