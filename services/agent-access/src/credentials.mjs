import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { importPKCS8, importSPKI, exportJWK, SignJWT, jwtVerify } from 'jose';
import { hash, transaction } from './store.mjs';

export const SCOPE = 'news:read';
export const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
export const CLAIM_GRANT = 'urn:workos:agent-auth:grant-type:claim';
export const ACCESS_TTL = 300;
export const REGISTRATION_TTL = 86400;
export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const fail = (code = 'invalid_request', status = 400) => { throw new HttpError(status, code); };

export async function credentials(db, issuer, now) {
  const keys = transaction(db, () => {
    const saved = db.prepare("SELECT value FROM settings WHERE key='signing-key'").get();
    if (saved) return JSON.parse(saved.value);
    const pair = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    db.prepare("INSERT INTO settings (key,value) VALUES ('signing-key',?)").run(JSON.stringify(pair));
    return pair;
  });
  const privateKey = await importPKCS8(keys.privateKey, 'EdDSA');
  const publicKey = await importSPKI(keys.publicKey, 'EdDSA');
  const jwk = await exportJWK(publicKey);
  const kid = hash(keys.publicKey).slice(0, 24);
  const resource = `${issuer}/api`;
  const sign = (row, kind, audience, expires) => new SignJWT({ kind, version: row.version, scope: SCOPE })
    .setProtectedHeader({ alg: 'EdDSA', typ: kind === 'assertion' ? 'oauth-id-jag+jwt' : 'at+jwt', kid })
    .setIssuer(issuer).setAudience(audience).setSubject(row.id).setJti(randomUUID())
    .setIssuedAt(now()).setExpirationTime(expires).sign(privateKey);

  async function verify(token, kind) {
    let payload;
    try {
      if (typeof token !== 'string' || token.length > 8192) throw new Error();
      ({ payload } = await jwtVerify(token, publicKey, {
        issuer, audience: kind === 'assertion' ? issuer : resource, algorithms: ['EdDSA'],
        typ: kind === 'assertion' ? 'oauth-id-jag+jwt' : 'at+jwt', currentDate: new Date(now() * 1000),
        requiredClaims: ['exp', 'iat', 'sub', 'jti'],
      }));
    } catch { fail(kind === 'access' ? 'invalid_token' : 'invalid_grant', kind === 'access' ? 401 : 400); }
    // Storage failures propagate as 503, never as a valid anonymous identity or a misleading bad token.
    const row = db.prepare('SELECT * FROM registrations WHERE id=?').get(payload.sub);
    if (!row || row.revoked || row.expires <= now() || payload.kind !== kind || payload.scope !== SCOPE
      || row.version !== payload.version || payload.iat > now() || payload.exp > row.expires
      || (kind === 'access' && payload.exp - payload.iat > ACCESS_TTL)
      || db.prepare('SELECT 1 FROM revoked_tokens WHERE digest=? AND expires>?').get(hash(token), now())) {
      fail(kind === 'access' ? 'invalid_token' : 'invalid_grant', kind === 'access' ? 401 : 400);
    }
    return { row, payload };
  }

  async function access(row) {
    const expires = Math.min(now() + ACCESS_TTL, row.expires);
    return { access_token: await sign(row, 'access', resource, expires), token_type: 'Bearer',
      expires_in: expires - now(), scope: SCOPE };
  }
  return { resource, verify, access, assertion: row => sign(row, 'assertion', issuer, row.expires),
    jwks: { keys: [{ ...jwk, alg: 'EdDSA', use: 'sig', kid }] } };
}
