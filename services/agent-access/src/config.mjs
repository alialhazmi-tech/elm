import { isAbsolute, resolve, sep } from 'node:path';

export function deploymentConfig(env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? env.AGENT_PORT ?? 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  if (!production) return { production: false, port, file: resolve(env.AGENT_DATA_FILE ?? 'data/agent-access.sqlite'), issuer: env.AGENT_ISSUER };
  if (env.AGENT_DEPLOYMENT !== 'railway' || !env.RAILWAY_ENVIRONMENT_ID) throw new Error('Production requires the dedicated Railway deployment');
  const issuer = new URL(env.AGENT_ISSUER ?? '');
  if (issuer.protocol !== 'https:' || issuer.origin !== env.AGENT_ISSUER || issuer.username || issuer.password) throw new Error('An exact HTTPS issuer origin is required');
  const mount = env.RAILWAY_VOLUME_MOUNT_PATH;
  const file = env.AGENT_DATA_FILE;
  if (!mount || !isAbsolute(mount) || !file || !isAbsolute(file) || !resolve(file).startsWith(resolve(mount) + sep)) {
    throw new Error('Agent storage must be inside its dedicated Railway volume');
  }
  const generation = env.AGENT_SIGNING_GENERATION;
  if (!generation || !/^[A-Za-z0-9_-]{1,64}$/.test(generation)) throw new Error('Signing generation required');
  const backup = backupConfig(env);
  return { production, port, file: resolve(file), issuer: issuer.origin, generation, backup };
}

export function backupConfig(env) {
  const names = ['AGENT_BACKUP_ENDPOINT', 'AGENT_BACKUP_BUCKET', 'AGENT_BACKUP_REGION',
    'AGENT_BACKUP_ACCESS_KEY_ID', 'AGENT_BACKUP_SECRET_ACCESS_KEY', 'AGENT_BACKUP_KEY'];
  if (names.some(name => !env[name])) throw new Error('Complete independent backup configuration is required');
  const endpoint = new URL(env.AGENT_BACKUP_ENDPOINT);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !/^[a-f0-9]{64}$/.test(env.AGENT_BACKUP_KEY)) throw new Error('Invalid encrypted backup configuration');
  return { endpoint: endpoint.origin, bucket: env.AGENT_BACKUP_BUCKET, region: env.AGENT_BACKUP_REGION,
    accessKeyId: env.AGENT_BACKUP_ACCESS_KEY_ID, secretAccessKey: env.AGENT_BACKUP_SECRET_ACCESS_KEY,
    key: Buffer.from(env.AGENT_BACKUP_KEY, 'hex'), forcePathStyle: env.AGENT_BACKUP_PATH_STYLE !== 'false' };
}
