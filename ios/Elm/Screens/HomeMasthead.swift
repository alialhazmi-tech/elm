import SwiftUI

/// مصطبة الرئيسية — الهوية أولًا: لوجو «العلم» وشعاره وسطر التاريخ وشارة التغطية.
/// تحل محل عنوان شريط التنقل الرمادي الذي كان يترك التطبيق بلا وجه.
struct HomeMasthead: View {
    var onSearch: () -> Void = {}
    var onLibrary: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 0) {
                        Text("الع").foregroundStyle(.white)
                        Text("ل").foregroundStyle(ElmTheme.gold)
                        Text("م").foregroundStyle(.white)
                    }
                    .font(ElmFonts.logo(.title2))
                    Text("المعرفة بسلاسة")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(Color.white.opacity(0.62))
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("العلم، المعرفة بسلاسة")
                .accessibilityAddTraits(.isHeader)

                Spacer(minLength: 8)

                HStack(spacing: 8) {
                    MastheadIcon(system: "magnifyingglass", label: "بحث", action: onSearch)
                    MastheadIcon(system: "bookmark", label: "المحفوظات", action: onLibrary)
                }
            }

            HStack(spacing: 8) {
                HStack(spacing: 5) {
                    Circle()
                        .fill(ElmTheme.gold)
                        .frame(width: 5, height: 5)
                    Text("تغطية مستمرة")
                        .font(ElmFonts.text(.caption2, weight: .bold))
                }
                .foregroundStyle(ElmTheme.gold)
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .background(ElmTheme.gold.opacity(0.16), in: Capsule())

                Text(ElmFormat.todayStrip())
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(Color.white.opacity(0.78))
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
            .accessibilityElement(children: .combine)
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.navyDeep)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 26, bottomTrailingRadius: 26, style: .continuous))
    }
}

private struct MastheadIcon: View {
    let system: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(Color.white.opacity(0.1), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
