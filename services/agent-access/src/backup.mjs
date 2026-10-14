import { backup, DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const PREFIX = 'agent-access/v1/';
const MAGIC = Buffer.from('ALELM-BACKUP-1\n');
const MAX_SIZE = 32 * 1024 * 1024;
export const BACKUP_INTERVAL = 6 * 60 * 60 * 1000;

export function encryptSnapshot(bytes, key) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptSnapshot(bytes, key) {
  if (bytes.length > MAX_SIZE || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid backup');
  const offset = MAGIC.length; const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(offset, offset + 12));
  decipher.setAAD(MAGIC); decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
  return Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]);
}
function verifySnapshot(file, expectedIssuer) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok'
      || db.prepare("SELECT value FROM settings WHERE key='issuer'").get()?.value !== expectedIssuer
      || !db.prepare("SELECT value FROM settings WHERE key='signing-key'").get()) throw new Error('Backup verification failed');
  } finally { db.close(); }
}

export function s3Storage(config) {
  const client = new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: config.forcePathStyle,
    maxAttempts: 2, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  const send = command => client.send(command, { abortSignal: AbortSignal.timeout(20_000) });
  return {
    put: (key, bytes) => send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: 'application/octet-stream' })),
    get: async key => {
      const result = await send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      const chunks = []; let size = 0;
      try {
        for await (const chunk of result.Body) {
          size += chunk.length; if (size > MAX_SIZE) throw new Error('Backup too large'); chunks.push(chunk);
        }
      } finally { result.Body.destroy(); }
      return Buffer.concat(chunks);
    },
    list: async () => {
      const keys = []; let continuation;
      do {
        const result = await send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: PREFIX, ContinuationToken: continuation }));
        keys.push(...(result.Contents ?? []).map(item => item.Key)); continuation = result.NextContinuationToken;
        if (keys.length > 10000) throw new Error('Unexpected backup inventory');
      } while (continuation);
      return keys.filter(key => key.endsWith('.enc')).sort();
    },
    remove: key => send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key })),
    close: () => client.destroy(),
  };
}

export function backupManager({ db, issuer, key, storage, audit = event => console.info(JSON.stringify(event)) }) {
  let lastSuccess = 0; let running;
  async function snapshot() {
    const directory = await mkdtemp(join(tmpdir(), 'agent-snapshot-'));
    try {
      const file = join(directory, 'snapshot.sqlite'); await backup(db, file); verifySnapshot(file, issuer);
      const bytes = await readFile(file); if (bytes.length > MAX_SIZE - 128) throw new Error('Backup too large');
      const objectKey = `${PREFIX}${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.enc`;
      await storage.put(objectKey, encryptSnapshot(bytes, key));
      // Read back and authenticate the off-volume copy before considering the backup successful.
      const recovered = decryptSnapshot(await storage.get(objectKey), key);
      if (!recovered.equals(bytes)) throw new Error('Backup round trip mismatch');
      const restoreCheck = join(directory, 'restore-check.sqlite'); await writeFile(restoreCheck, recovered, { mode: 0o600 });
      verifySnapshot(restoreCheck, issuer);
      lastSuccess = Date.now(); audit({ event: 'backup_verified', at: new Date(lastSuccess).toISOString() });
      const keys = await storage.list();
      // Retain at least 7 days, bounded by the 6-hour schedule; redeploys do not prematurely delete recent snapshots.
      const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString().replaceAll(':', '-');
      for (const old of keys.slice(0, -1)) if (old.slice(PREFIX.length, PREFIX.length + 24) < cutoff) await storage.remove(old);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  const run = () => {
    if (!running) running = snapshot().finally(() => { running = undefined; });
    return running;
  };
  const timer = setInterval(() => { run().catch(() => audit({ event: 'backup_failed' })); }, BACKUP_INTERVAL); timer.unref();
  return { run, healthy: () => lastSuccess > 0 && Date.now() - lastSuccess < 2 * BACKUP_INTERVAL,
    close: async () => { clearInterval(timer); if (running) await running.catch(() => {}); storage.close(); } };
}

export async function restoreSnapshot({ storage, key, objectKey, issuer, target }) {
  if (!objectKey.startsWith(PREFIX) || !objectKey.endsWith('.enc')) throw new Error('Invalid backup object');
  const directory = await mkdtemp(join(tmpdir(), 'agent-restore-'));
  try {
    const file = join(directory, 'restored.sqlite');
    await writeFile(file, decryptSnapshot(await storage.get(objectKey), key), { mode: 0o600 });
    verifySnapshot(file, issuer);
    const restored = new DatabaseSync(file);
    try {
      // Never resurrect credentials revoked after a snapshot. All agents must register again after disaster recovery.
      restored.exec('BEGIN IMMEDIATE; UPDATE registrations SET revoked=1,version=version+1,owner=NULL; DELETE FROM claims; DELETE FROM owners; DELETE FROM rate_limits; COMMIT;');
    } finally { restored.close(); }
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(file, target, constants.COPYFILE_EXCL);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
