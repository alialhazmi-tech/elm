import SwiftUI

/// 1i — العضوية: خطتان، تجربة 7 أيام، والشراء عبر StoreKit 2 في مرحلة M4.
struct MembershipScreen: View {
    @Environment(MemberSessionStore.self) private var member
    @State private var plan = "yearly"
    @State private var note: String?

    private struct Plan: Identifiable {
        let id: String
        let name: String
        let price: String
        let per: String
        let note: String
        let badge: String?
    }

    private let plans: [Plan] = [
        .init(id: "monthly", name: "شهرية", price: "29", per: " ر.س/شهر",
              note: "كل المزايا، بلا التزام — ألغِ متى شئت.", badge: nil),
        .init(id: "yearly", name: "سنوية", price: "249", per: " ر.س/سنة",
              note: "بسعر سبعة أشهر — وأرشيف العلم كاملًا.", badge: "الأوفر"),
    ]

    private let perks = [
        "الأرشيف كاملًا — السلاسل الثماني والمواد الموسعة",
        "«اسأل العلم» بلا حد يومي، مع مصادر من مواد المحررين",
        "الاستماع للمواد والتنزيل للقراءة بلا اتصال",
        "موجز صباحي مخصص من اهتماماتك",
    ]

    var body: some View {
        ElmScreen(title: "العضوية", showBack: true) {
            VStack(alignment: .leading, spacing: 0) {
                hero

                VStack(spacing: 10) {
                    ForEach(plans) { item in
                        planCard(item)
                    }
                }
                .padding(.top, 14)

                VStack(alignment: .leading, spacing: 9) {
                    ForEach(perks, id: \.self) { perk in
                        HStack(alignment: .top, spacing: 10) {
                            Text("✓")
                                .font(ElmFonts.text(.footnote, weight: .bold))
                                .foregroundStyle(ElmTheme.teal)
                            Text(perk)
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(ElmTheme.ink2)
                                .multilineTextAlignment(.leading)
                                .lineSpacing(3)
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(.top, 16)

                Button(action: subscribe) {
                    Text(member.isSignedIn ? "اشترك الآن" : "أنشئ حسابك ثم اشترك")
                        .font(ElmFonts.text(.subheadline, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 18)

                if let note {
                    Text(note)
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink2)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 10)
                }

                Text("تجربة 7 أيام مجانًا · يمكنك الإلغاء متى شئت")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("عضوية العلم")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.gold)
            Text("اقرأ أعمق، وبلا ضجيج.")
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .padding(.top, 8)
            Text("الأرشيف كاملًا، «اسأل العلم» بلا حد، الاستماع والتنزيل — ونشرة المحررين.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(Color(red: 0.78, green: 0.82, blue: 0.89))
                .lineSpacing(4)
                .multilineTextAlignment(.leading)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(ElmTheme.navyDeep)
        .overlay(alignment: .top) {
            Rectangle().fill(ElmTheme.spectrumGradient).frame(height: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func planCard(_ item: Plan) -> some View {
        let selected = plan == item.id
        return Button { plan = item.id } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 9) {
                    Text(item.name)
                        .font(ElmFonts.display(.headline, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    if let badge = item.badge {
                        Text(badge)
                            .font(ElmFonts.text(.caption2, weight: .bold))
                            .foregroundStyle(Color(red: 0.16, green: 0.11, blue: 0))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 3)
                            .background(ElmTheme.gold, in: Capsule())
                    }
                    Spacer(minLength: 0)
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text(item.price)
                            .font(ElmFonts.display(.title3, weight: .heavy))
                            .foregroundStyle(ElmTheme.ink)
                        Text(item.per)
                            .font(ElmFonts.text(.caption2, weight: .medium))
                            .foregroundStyle(ElmTheme.ink3)
                    }
                    .elmLatin()
                }
                Text(item.note)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink2)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
            .background(selected ? ElmTheme.surface2 : ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(selected ? ElmTheme.ink : ElmTheme.line, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private func subscribe() {
        guard member.isSignedIn else {
            member.authPresented = true
            return
        }
        // لا شراء وهمي: الاشتراك يمر عبر StoreKit 2 في المرحلة M4.
        note = "الشراء داخل التطبيق يُفعَّل مع StoreKit 2. حتى ذلك الحين تُدار العضوية من حسابك على الموقع."
    }
}
