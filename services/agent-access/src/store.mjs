import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const secret = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const normalizeEmail = email => typeof email === 'string' && email.length <= 254
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.trim().toLowerCase() : null;

export function openStore(file) {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(file);
  if (file !== ':memory:') chmodSync(file, 0o600);
  db.exec(`PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS owners (
      email TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, claim_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1, revoked INTEGER NOT NULL DEFAULT 0,
      owner TEXT REFERENCES owners(email), claim_delivered INTEGER NOT NULL DEFAULT 0,
      poll_after INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS claims (
      registration TEXT PRIMARY KEY REFERENCES registrations(id) ON DELETE CASCADE,
      attempt_hash TEXT UNIQUE NOT NULL, code_hash TEXT NOT NULL, email TEXT NOT NULL,
      expires INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0, consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS revoked_tokens (digest TEXT PRIMARY KEY, expires INTEGER NOT NULL);
  `);
  return db;
}

export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export async function createOwner(db, email, password) {
  email = normalizeEmail(email);
  if (!email || typeof password !== 'string' || password.length < 16 || password.length > 256) {
    throw new Error('A valid email and a unique 16–256 character password are required');
  }
  const salt = secret();
  const digest = await scrypt(password, salt, 64);
  db.prepare('INSERT INTO owners (email,salt,password_hash) VALUES (?,?,?)').run(email, salt, digest.toString('hex'));
}

export async function verifyOwner(db, email, password, now) {
  email = normalizeEmail(email);
  if (!email || typeof password !== 'string' || password.length > 256) return false;
  const owner = db.prepare('SELECT * FROM owners WHERE email=?').get(email);
  const digest = await scrypt(password, owner?.salt ?? 'unknown-owner-timing-padding', 64);
  const current = db.prepare('SELECT * FROM owners WHERE email=?').get(email);
  if (!owner || !current || current.locked_until > now || current.password_hash !== owner.password_hash) return false;
  const matches = timingSafeEqual(digest, Buffer.from(owner.password_hash, 'hex'));
  if (!matches) {
    db.prepare(`UPDATE owners SET failures=failures+1,
      locked_until=CASE WHEN failures>=9 THEN ? ELSE locked_until END WHERE email=?`).run(now + 1800, email);
    return false;
  }
  db.prepare('UPDATE owners SET failures=0,locked_until=0 WHERE email=?').run(email);
  return true;
}

export function revokeRegistration(db, id) {
  return db.prepare('UPDATE registrations SET revoked=1,version=version+1 WHERE id=? AND revoked=0').run(id).changes;
}
export function prune(db, now) {
  db.prepare('DELETE FROM registrations WHERE expires<=?').run(now);
  db.prepare('DELETE FROM revoked_tokens WHERE expires<=?').run(now);
}
