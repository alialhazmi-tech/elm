import Foundation

/// بلوك قابل للتحرير في محرر الهاتف: نص واحد لكل بلوك، والتنسيق الداخلي بترميز خفيف
/// (`**غامق**`، `*مائل*`، `++تسطير++`، `~~مشطوب~~`، `[نص](رابط)`) يتحول إلى HTML المنقّى نفسه
/// الذي يقبله الخادم (`sanitizeBodyHtml`) — فلا يضيع رابط ولا تأكيد عند التحرير من الجوال.
struct EditableBlock: Identifiable, Equatable, Hashable {
    enum Kind: String, CaseIterable, Identifiable {
        case paragraph, heading2, heading3, quote, bullets, numbered
        var id: String { rawValue }
        var label: String {
            switch self {
            case .paragraph: "فقرة"
            case .heading2: "عنوان فرعي"
            case .heading3: "عنوان أصغر"
            case .quote: "اقتباس"
            case .bullets: "قائمة نقطية"
            case .numbered: "قائمة مرقّمة"
            }
        }
        var symbol: String {
            switch self {
            case .paragraph: "text.alignright"
            case .heading2: "textformat.size.larger"
            case .heading3: "textformat.size"
            case .quote: "text.quote"
            case .bullets: "list.bullet"
            case .numbered: "list.number"
            }
        }
    }

    var id = UUID()
    var kind: Kind = .paragraph
    /// النص بالترميز الخفيف؛ في القوائم كل سطر عنصر.
    var text: String = ""
    var align: String? = nil
    var postId: String? = nil
}

enum EditorMarkup {
    // MARK: HTML → بلوكات

    static func blocks(fromHTML html: String) -> [EditableBlock] {
        let parsed = ArticleBlocks.parse(html: html)
        guard !parsed.isEmpty else { return [EditableBlock()] }
        return parsed.map { block in
            switch block.type {
            case "heading":
                return EditableBlock(kind: block.level == 3 ? .heading3 : .heading2, text: markup(block.runs ?? []), align: block.align)
            case "list":
                let lines = (block.items ?? []).map { markup($0) }.joined(separator: "\n")
                return EditableBlock(kind: block.ordered == true ? .numbered : .bullets, text: lines)
            case "quote", "xpost":
                return EditableBlock(kind: .quote, text: markup(block.runs ?? []), postId: block.postId)
            default:
                return EditableBlock(kind: .paragraph, text: markup(block.runs ?? []), align: block.align)
            }
        }
    }

    /// أجزاء منسّقة → ترميز خفيف.
    static func markup(_ runs: [ArticleRun]) -> String {
        runs.map { run in
            var text = run.text.replacingOccurrences(of: "\\", with: "\\\\")
            for token in ["**", "++", "~~", "*", "[", "]"] where text.contains(token) {
                text = text.replacingOccurrences(of: token, with: "\\" + token)
            }
            if run.bold == true { text = "**\(text)**" }
            if run.italic == true { text = "*\(text)*" }
            if run.underline == true { text = "++\(text)++" }
            if run.strike == true { text = "~~\(text)~~" }
            if let href = run.href { text = "[\(text)](\(href))" }
            return text
        }.joined()
    }

    // MARK: بلوكات → HTML

    static func html(from blocks: [EditableBlock]) -> String {
        blocks.compactMap { block -> String? in
            let text = block.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            let style = block.align.flatMap { ["center", "left", "justify"].contains($0) ? " style=\"text-align:\($0)\"" : nil } ?? ""
            switch block.kind {
            case .paragraph: return "<p\(style)>\(inline(text))</p>"
            case .heading2: return "<h2\(style)>\(inline(text))</h2>"
            case .heading3: return "<h3\(style)>\(inline(text))</h3>"
            case .quote:
                let attr = block.postId.map { " data-x-post=\"\($0)\"" } ?? ""
                return "<blockquote\(attr)>\(inline(text))</blockquote>"
            case .bullets, .numbered:
                let tag = block.kind == .bullets ? "ul" : "ol"
                let items = text.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                return "<\(tag)>" + items.map { "<li>\(inline($0))</li>" }.joined() + "</\(tag)>"
            }
        }.joined()
    }

    /// ترميز خفيف → HTML داخلي مع تهريب الحروف الخاصة.
    static func inline(_ source: String) -> String {
        var output = ""
        var index = source.startIndex
        var bold = false, italic = false, underline = false, strike = false
        func escape(_ char: Character) -> String {
            switch char {
            case "&": "&amp;"
            case "<": "&lt;"
            case ">": "&gt;"
            case "\n": "<br>"
            default: String(char)
            }
        }
        while index < source.endIndex {
            let char = source[index]
            let rest = source[index...]
            if char == "\\", source.index(after: index) < source.endIndex {
                let next = source.index(after: index)
                output += escape(source[next])
                index = source.index(after: next)
                continue
            }
            if rest.hasPrefix("**") { output += bold ? "</strong>" : "<strong>"; bold.toggle(); index = source.index(index, offsetBy: 2); continue }
            if rest.hasPrefix("++") { output += underline ? "</u>" : "<u>"; underline.toggle(); index = source.index(index, offsetBy: 2); continue }
            if rest.hasPrefix("~~") { output += strike ? "</s>" : "<s>"; strike.toggle(); index = source.index(index, offsetBy: 2); continue }
            if char == "*" { output += italic ? "</em>" : "<em>"; italic.toggle(); index = source.index(after: index); continue }
            if char == "[", let link = parseLink(in: source, from: index) {
                output += "<a href=\"\(link.href.replacingOccurrences(of: "\"", with: "%22"))\">\(inline(link.label))</a>"
                index = link.end
                continue
            }
            output += escape(char)
            index = source.index(after: index)
        }
        if bold { output += "</strong>" }
        if italic { output += "</em>" }
        if underline { output += "</u>" }
        if strike { output += "</s>" }
        return output
    }

    private static func parseLink(in source: String, from start: String.Index) -> (label: String, href: String, end: String.Index)? {
        guard let close = source[start...].firstIndex(of: "]") else { return nil }
        let afterClose = source.index(after: close)
        guard afterClose < source.endIndex, source[afterClose] == "(", let end = source[afterClose...].firstIndex(of: ")") else { return nil }
        let label = String(source[source.index(after: start)..<close])
        let href = String(source[source.index(after: afterClose)..<end]).trimmingCharacters(in: .whitespaces)
        guard href.hasPrefix("http://") || href.hasPrefix("https://") || href.hasPrefix("/") else { return nil }
        return (label, href, source.index(after: end))
    }

    /// عدد الكلمات للنص الخام (بلا ترميز).
    static func wordCount(_ blocks: [EditableBlock]) -> Int {
        blocks.map(\.text).joined(separator: " ")
            .replacingOccurrences(of: #"[*\[\]()+~]"#, with: " ", options: .regularExpression)
            .split { $0.isWhitespace || $0.isNewline }
            .count
    }
}
