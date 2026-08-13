import SwiftUI

/// حاوية الشاشة: رأس زجاجي ثابت + محتوى يمرّ تحته، وخلفية «المنشور».
/// كل شاشة تستخدمها فتظل الهوية والمسافات واحدة بلا تكرار.
struct ElmScreen<Content: View>: View {
    var title: String = ""
    var showBrand: Bool = false
    var showBack: Bool = false
    var showTools: Bool = true
    var scrolls: Bool = true
    /// مساحة تحت المحتوى حتى لا يختفي آخره خلف شريط التبويب.
    var bottomInset: CGFloat = 92
    /// شريط تقدّم القراءة بطيف السلاسل تحت الرأس — للقارئ فقط.
    var progress: Double? = nil
    var onRefresh: (() async -> Void)?
    @ViewBuilder var content: () -> Content

    @State private var route: HeaderRoute?

    var body: some View {
        VStack(spacing: 0) {
            ElmHeader(
                title: title,
                showBrand: showBrand,
                showBack: showBack,
                showTools: showTools,
                route: $route
            )

            if let progress {
                ZStack(alignment: .leading) {
                    Rectangle().fill(ElmTheme.line)
                    GeometryReader { proxy in
                        Rectangle()
                            .fill(ElmTheme.spectrumGradient)
                            .frame(width: proxy.size.width * max(0, min(1, progress)))
                    }
                }
                .frame(height: 3)
                .accessibilityHidden(true)
            }

            if scrolls {
                ScrollView {
                    content()
                        .padding(.bottom, bottomInset)
                }
                .coordinateSpace(name: ElmScrollSpace.name)
                .scrollDismissesKeyboard(.interactively)
                .refreshable {
                    if let onRefresh { await onRefresh() }
                }
            } else {
                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $route) { destination in
            switch destination {
            case .search: SearchScreen()
            case .notifications: NotificationsScreen()
            }
        }
    }
}

/// فضاء إحداثيات تمرير الشاشة — يقيس منه القارئ تقدّمه.
enum ElmScrollSpace {
    static let name = "elmScroll"
}

struct ElmScrollMetrics: Equatable {
    var offset: CGFloat = 0
    var contentHeight: CGFloat = 1
}

struct ElmScrollKey: PreferenceKey {
    static let defaultValue = ElmScrollMetrics()
    static func reduce(value: inout ElmScrollMetrics, nextValue: () -> ElmScrollMetrics) {
        value = nextValue()
    }
}

extension View {
    /// يُلحق بمحتوى الشاشة فيبلّغ موضع التمرير دون أن يلفّ المحتوى بـ GeometryReader
    /// (لفّه يمنع رسم AsyncImage — فخ مثبّت بالتجربة).
    func reportsScroll() -> some View {
        background(
            GeometryReader { proxy in
                Color.clear.preference(
                    key: ElmScrollKey.self,
                    value: ElmScrollMetrics(
                        offset: -proxy.frame(in: .named(ElmScrollSpace.name)).minY,
                        contentHeight: proxy.size.height
                    )
                )
            }
        )
    }
}

/// عنوان قسم داخل الشاشة: اسم عريض وسطر شارح خافت بجواره.
struct SectionHead: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(title)
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            if let subtitle {
                Text(subtitle)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// شريط الطيف الثماني — توقيع «العلم» البصري أعلى السلاسل والعضوية.
struct SpectrumBar: View {
    var height: CGFloat = 6
    var corner: CGFloat = 3

    var body: some View {
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(ElmTheme.spectrumGradient)
            .frame(height: height)
            .accessibilityHidden(true)
    }
}

/// كبسولة السلسلة الملوّنة فوق الصور والعناوين.
struct SeriesChipLabel: View {
    let name: String
    let color: Color
    var onDark: Bool = false

    var body: some View {
        Text(name)
            .font(ElmFonts.text(.caption, weight: .bold))
            .foregroundStyle(onDark ? Color(white: 0.08) : .white)
            .padding(.horizontal, 11)
            .padding(.vertical, 4)
            .background(color, in: Capsule())
    }
}

/// شريحة اختيار (الكل / لماذا / أبسط…) — نشطة بالحبر، خاملة بالسطح.
struct ElmChip: View {
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(ElmFonts.text(.footnote, weight: selected ? .bold : .medium))
                .foregroundStyle(selected ? ElmTheme.surface : ElmTheme.ink2)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(selected ? ElmTheme.ink : ElmTheme.surface, in: Capsule())
                .overlay(Capsule().stroke(selected ? Color.clear : ElmTheme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

/// مفتاح تبديل بهوية العلم — أخضر عند التفعيل، رمادي الحدّ عند الإطفاء.
struct ElmToggle: View {
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Capsule()
                .fill(isOn ? ElmTheme.teal : ElmTheme.line2)
                .frame(width: 46, height: 28)
                // في RTL تعني `.trailing` اليسار — والمقبض يسارًا عند التفعيل كما في iOS.
                .overlay(alignment: isOn ? .trailing : .leading) {
                    Circle()
                        .fill(.white)
                        .frame(width: 22, height: 22)
                        .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                        .padding(3)
                }
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.2), value: isOn)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(isOn ? "مُفعّل" : "مُعطّل")
    }
}
