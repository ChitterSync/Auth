import crypto from 'node:crypto';

const DEFAULT_TOKEN_BYTES = 32;

export const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createToken = (bytes = DEFAULT_TOKEN_BYTES) =>
  crypto.randomBytes(bytes).toString('base64url');

export const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
