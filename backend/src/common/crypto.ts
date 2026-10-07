import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function encrypt(value: string, key: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const data = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((v) => v.toString('base64url')).join('.');
}
export function decrypt(value: string, key: string) {
  const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64url'));
  const c = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  c.setAuthTag(tag);
  return Buffer.concat([c.update(data), c.final()]).toString('utf8');
}
