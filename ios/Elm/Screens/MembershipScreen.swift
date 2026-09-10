import SwiftUI

/// العضوية مجانية كما على `/join` — لا خطط ولا أسعار ولا تجربة: نصوص الويب نفسها، ودعوة
/// «إنشاء حساب مجاني» / «لدي حساب» للزائر، وحالة «عضوية مجانية» للعضو.
struct MembershipScreen: View {
    @Environment(MemberSessionStore.self) private var member
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var account = AccountStore()

    private struct Perk: Identifiable {
        let symbol: String
        let title: String
        let detail: String
        var id: String { title }
    }

    /// `app/join/page.tsx` — قائمة المزايا بنصها.
    private let perks: [Perk] = [
        .init(symbol: "safari", title: "ترشيحات أقرب لاهتماماتك", detail: "اختر الموضوعات التي تحب متابعتها."),
        .init(symbol: "bookmark", title: "مكتبة تعود إليها", detail: "احفظ المواد وتابع سجل قراءاتك."),
        .init(symbol: "checkmark.shield", title: "أنت تتحكم بتجربتك", detail: "عدّل اهتماماتك وإعدادات الخصوصية."),
    ]

    var body: some View {
        ElmScreen(title: "العضوية", showBack: true, onRefresh: { if member.isSignedIn { await account.load() } }) {
            VStack(alignment: .leading, spacing: 0) {
                if member.suspended {
                    SuspendedPanel()
                } else {
                    hero
                    perksList.padding(.top, 16)
                    if member.isSignedIn { memberCard.padding(.top, 18) } else { guestActions.padding(.top, 18) }
                }

                PublicPageLink(path: "/privacy-policy") {
                    Text("سياسة الخصوصية")
                        .font(ElmFonts.text(.footnote, weight: .semibold))
                        .foregroundStyle(ElmTheme.navyInk)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .padding(.top, 10)
                .accessibilityHint("تفتح سياسة الخصوصية من الموقع")
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .frame(maxWidth: sizeClass == .regular ? 720 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task(id: member.user?.id) { if member.isSignedIn { await account.load() } }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("أهلًا بك في العلم")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.gold)
            Text("مساحتك.\nللمعرفة التي تهمّك.")
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .lineSpacing(3)
                .padding(.top, 8)
            Text("قراءاتك، اختياراتك، وما تودّ العودة إليه.\nكلّها في مكان واحد، بعضوية مجانية.")
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
        .accessibilityElement(children: .combine)
    }

    private var perksList: some View {
        VStack(spacing: 10) {
            ForEach(perks) { perk in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: perk.symbol)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ElmTheme.accent)
                        .frame(width: 38, height: 38)
                        .background(ElmTheme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(perk.title)
                            .font(ElmFonts.display(.subheadline, weight: .bold))
                            .foregroundStyle(ElmTheme.ink)
                        Text(perk.detail)
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                            .lineSpacing(3)
                    }
                    Spacer(minLength: 0)
                }
                .padding(13)
                .frame(maxWidth: .infinity, alignment: .leading)
                .elmCard(radius: 16, elevated: false)
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var guestActions: some View {
        VStack(spacing: 10) {
            Button {
                member.authInitialMode = .signUp
                member.authPresented = true
            } label: {
                Text("إنشاء حساب مجاني")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            Button {
                member.authInitialMode = .signIn
                member.authPresented = true
            } label: {
                Text("لدي حساب")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var memberCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(ElmTheme.success)
                Text("عضوية مجانية")
                    .font(ElmFonts.display(.headline, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
            }
            if let name = member.user?.name, !name.isEmpty {
                Text(name).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
            }
            if let email = member.user?.email {
                Text(email).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).elmLatin()
            }
            if let joined = ElmFormat.brandDate(account.overview?.user?.joinedAt) {
                Text("عضو منذ \(joined)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            }
            Text("لا رسوم ولا خطط مدفوعة. الاسم وكلمة المرور والنشرة والخصوصية من «إعدادات الحساب».")
                .font(ElmFonts.text(.caption))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
            NavigationLink { AccountSettingsScreen() } label: {
                Text("إعدادات الحساب")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16, elevated: false)
    }
}

/// حالة الحساب المعلّق بنص `/join` نفسه وزر الخروج (المسار الوحيد المتاح للمعلّق).
struct SuspendedPanel: View {
    @Environment(MemberSessionStore.self) private var member
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(ElmTheme.danger)
            Text(MemberSessionStore.suspendedTitle)
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
                .accessibilityAddTraits(.isHeader)
            Text(MemberSessionStore.suspendedText)
                .font(ElmFonts.text(.body))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(4)
            Button { Task { await member.signOut() } } label: {
                Text(member.loading ? "لحظة…" : "تسجيل الخروج")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(member.loading)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.danger.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(ElmTheme.danger.opacity(0.35), lineWidth: 1))
    }
}
