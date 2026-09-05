import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  renderAccountEmail,
  emailValidity,
} from "../lib/membership/email/templates.ts";
import {
  createResetReceipt,
  readResetReceipt,
} from "../lib/membership/email/reset-receipt.ts";
import {
  prepareNeonAccountEmail,
  verifyNeonEmailWebhook,
} from "../lib/membership/email/webhook.ts";
import { deliverAccountEmail } from "../lib/membership/email/delivery.ts";

const now = Date.now();
const issuedAt = new Date(now).toISOString();
const expiresAt = new Date(now + 3_600_000).toISOString();
const secret = "test-receipt-secret-independent-32-characters";
const fixture = {
  event_id: "test-event-123",
  event_type: "send.magic_link",
  timestamp: issuedAt,
  user: { email: "reader@example.invalid", name: "علي" },
  event_data: {
    link_type: "forget-password",
    token: "synthetic-token",
    expires_at: expiresAt,
    link_url: "https://untrusted.invalid/?callbackURL=https://evil.invalid",
  },
};

test("القوالب الثمانية عربية وتمنع حقن HTML وروابط النطاقات الأخرى", () => {
  for (const kind of [
    "reset-link",
    "verify-otp",
    "verify-link",
    "reset-otp",
    "signin-otp",
    "signin-link",
    "welcome",
    "password-changed",
  ]) {
    const email = renderAccountEmail({
      kind,
      name: '<img src=x onerror="alert(1)">',
      otp: "123456",
      actionUrl: "https://alelm.net/join/reset?token=example",
      issuedAt,
      expiresAt,
      changedAt: "2026-09-05T08:00:00Z",
    });
    assert.match(email.html, /lang="ar" dir="rtl"/);
    assert.match(email.html, /&lt;img src=x/);
    assert.doesNotMatch(
      email.html,
      /<img src=x|neon\.tech|Reset Password|Hello/,
    );
    for (const [, url] of email.html.matchAll(/(?:href|src)="([^"]+)"/g))
      assert.equal(new URL(url).origin, "https://alelm.net");
    assert.ok(email.text.includes("للمساعدة"));
  }
  assert.throws(() =>
    renderAccountEmail({
      kind: "reset-link",
      actionUrl: "https://alelm.net.evil.invalid",
      issuedAt,
      expiresAt,
    }),
  );
  assert.throws(() =>
    renderAccountEmail({
      kind: "verify-otp",
      otp: "<1234>",
      issuedAt,
      expiresAt,
    }),
  );
});

test("مدة الصلاحية من الحدث وتاريخ تغيير كلمة المرور ميلادي بتوقيت السعودية", () => {
  assert.equal(emailValidity(issuedAt, expiresAt), "ساعة واحدة");
  assert.equal(
    emailValidity(issuedAt, new Date(now + 300_000).toISOString()),
    "5 دقائق",
  );
  assert.throws(() => emailValidity("invalid", expiresAt));
  assert.throws(() => emailValidity(expiresAt, issuedAt));
  const email = renderAccountEmail({
    kind: "password-changed",
    changedAt: "2026-09-05T08:00:00Z",
  });
  assert.match(email.text, /2026/);
  assert.match(email.text, /11:00/);
  assert.match(email.text, /mode=forgot/);
});

test("روابط الاستعادة على العلم وثابتة بين محاولات التسليم وتتجاهل رابط المزود", () => {
  const first = prepareNeonAccountEmail(fixture, secret, now);
  assert.deepEqual(first, prepareNeonAccountEmail(fixture, secret, now + 1000));
  const link = first.email.text.match(
    /https:\/\/alelm.net\/join\/reset\?\S+/,
  )[0];
  const url = new URL(link);
  assert.equal(url.searchParams.get("token"), "synthetic-token");
  assert.equal(
    readResetReceipt(
      url.searchParams.get("receipt"),
      "synthetic-token",
      secret,
      now,
    ).email,
    fixture.user.email,
  );
  assert.doesNotMatch(first.email.html, /untrusted|evil\.invalid/);
  assert.throws(() =>
    prepareNeonAccountEmail(fixture, secret, now + 3_600_001),
  );
  assert.throws(() =>
    prepareNeonAccountEmail(
      { ...fixture, event_type: "user.created" },
      secret,
      now,
    ),
  );
  assert.throws(() =>
    prepareNeonAccountEmail(
      {
        ...fixture,
        event_data: { ...fixture.event_data, link_type: "sign-in" },
      },
      secret,
      now,
    ),
  );
});

test("أنواع OTP لا تتداخل ولا يُرسل طلب SMS كبريد", () => {
  for (const [type, subject] of [
    ["email-verification", "توثيق"],
    ["forget-password", "إعادة تعيين"],
    ["sign-in", "دخولك"],
  ]) {
    const event = {
      ...fixture,
      event_type: "send.otp",
      event_data: { otp_type: type, otp_code: "123456", expires_at: expiresAt },
    };
    assert.ok(
      prepareNeonAccountEmail(event, secret, now).email.subject.includes(
        subject,
      ),
    );
    assert.throws(() =>
      prepareNeonAccountEmail(
        {
          ...event,
          event_data: { ...event.event_data, delivery_preference: "sms" },
        },
        secret,
        now,
      ),
    );
  }
});

test("إيصال الإشعار مربوط برمز الاستعادة وتوقيع الخادم ولا يقبل العبث أو انتهاء المدة", () => {
  const receipt = createResetReceipt(
    {
      email: fixture.user.email,
      token: "token-a",
      eventId: "event-a",
      expiresAt,
    },
    secret,
  );
  assert.ok(readResetReceipt(receipt, "token-a", secret, now));
  assert.equal(readResetReceipt(receipt, "token-b", secret, now), null);
  assert.equal(
    readResetReceipt(receipt, "token-a", secret + "wrong", now),
    null,
  );
  assert.equal(
    readResetReceipt(receipt, "token-a", secret, now + 3_600_001),
    null,
  );
  const [body, signature] = receipt.split(".");
  const modified = JSON.parse(Buffer.from(body, "base64url"));
  modified.email = "attacker@example.invalid";
  assert.equal(
    readResetReceipt(
      `${Buffer.from(JSON.stringify(modified)).toString("base64url")}.${signature}`,
      "token-a",
      secret,
      now,
    ),
    null,
  );
});

test("توقيع Neon يتحقق من الجسم الخام والوقت والخوارزمية ويستخدم مفاتيح الفرع الموثوق", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const key = {
    ...publicKey.export({ format: "jwk" }),
    kid: "test-key",
    alg: "EdDSA",
  };
  const body = JSON.stringify(fixture);
  function headersFor(at = now, alg = "EdDSA") {
    const header = Buffer.from(JSON.stringify({ alg, kid: key.kid })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      `${at}.${Buffer.from(body).toString("base64url")}`,
    ).toString("base64url");
    return new Headers({
      "x-neon-signature": `${header}..${sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString("base64url")}`,
      "x-neon-signature-kid": key.kid,
      "x-neon-timestamp": String(at),
    });
  }
  let calls = 0;
  const transport = async (url) => {
    calls++;
    assert.equal(
      url,
      "https://auth.example.invalid/auth/.well-known/jwks.json",
    );
    return Response.json({ keys: [key] });
  };
  const verify = (raw, headers) =>
    verifyNeonEmailWebhook(
      raw,
      headers,
      "https://auth.example.invalid/auth",
      transport,
      now,
    );
  assert.deepEqual(await verify(body, headersFor()), fixture);
  await assert.rejects(verify(body + " ", headersFor()));
  await assert.rejects(verify(body, headersFor(now - 300_001)));
  await assert.rejects(verify(body, headersFor(now + 300_001)));
  await assert.rejects(verify(body, headersFor(now, "none")));
  assert.equal(calls, 1);
});

test("تعطل جلب مفاتيح Neon يسمح بإعادة المحاولة ولا يُعد توقيعًا غير صالح", async () => {
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", kid: "key" }),
  ).toString("base64url");
  const headers = new Headers({
    "x-neon-signature": `${header}..a`,
    "x-neon-signature-kid": "key",
    "x-neon-timestamp": String(now),
  });
  await assert.rejects(
    verifyNeonEmailWebhook(
      "{}",
      headers,
      "https://keys-unavailable.example.invalid/auth",
      async () => {
        throw new Error("timeout");
      },
      now,
    ),
    /WEBHOOK_KEYS_UNAVAILABLE/,
  );
});

test("الإرسال مغلق افتراضيًا؛ يرسل HTML ونصًا بهوية العلم ومفتاح منع التكرار", async () => {
  const enabled = process.env.ACCOUNT_EMAIL_ENABLED,
    apiKey = process.env.RESEND_API_KEY;
  try {
    delete process.env.ACCOUNT_EMAIL_ENABLED;
    const email = renderAccountEmail({ kind: "welcome", name: "عضو تجريبي" });
    await assert.rejects(
      deliverAccountEmail(
        "member@example.invalid",
        email,
        "welcome/test",
        () => {
          throw new Error("unexpected send");
        },
      ),
      /NOT_CONFIGURED/,
    );
    process.env.ACCOUNT_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "fake-test-key";
    await deliverAccountEmail(
      "member@example.invalid",
      email,
      "welcome/test",
      async (url, init) => {
        assert.equal(url, "https://api.resend.com/emails");
        assert.equal(init.headers["Idempotency-Key"], "welcome/test");
        assert.equal(init.cache, "no-store");
        const body = JSON.parse(init.body);
        assert.equal(body.from, "العلم <accounts@alelm.net>");
        assert.deepEqual(body.to, ["member@example.invalid"]);
        assert.equal(body.html, email.html);
        assert.equal(body.text, email.text);
        return Response.json({ id: "test-only" });
      },
    );
    await assert.rejects(
      deliverAccountEmail(
        "member@example.invalid",
        email,
        "welcome/test",
        async () =>
          new Response("sensitive provider response", { status: 429 }),
      ),
      /^Error: ACCOUNT_EMAIL_DELIVERY_429$/,
    );
  } finally {
    if (enabled === undefined) delete process.env.ACCOUNT_EMAIL_ENABLED;
    else process.env.ACCOUNT_EMAIL_ENABLED = enabled;
    if (apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = apiKey;
  }
});
