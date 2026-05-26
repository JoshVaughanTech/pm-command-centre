import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();

  for (const [k, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= windowMs) rateLimitStore.delete(k);
  }

  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.count += 1;
  return { success: true, remaining: maxRequests - entry.count };
}

// ---------------------------------------------------------------------------
// Input Sanitisation
// ---------------------------------------------------------------------------

export function sanitise(input: string, maxLength = 1000): string {
  let cleaned = input.replace(/<[^>]*>/g, '');
  cleaned = cleaned.trim();
  if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength);
  return cleaned;
}

// ---------------------------------------------------------------------------
// Token Obfuscation (HMAC-signed base64 — not full encryption but protects
// against casual database reads. For full encryption, use a KMS.)
// ---------------------------------------------------------------------------

export function encryptToken(plaintext: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'dev';
  const encoded = Buffer.from(plaintext).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64').slice(0, 16);
  return sig + '.' + encoded;
}

export function decryptToken(token: string): string {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return token; // Not obfuscated, return as-is
  const encoded = token.slice(dotIdx + 1);
  return Buffer.from(encoded, 'base64').toString('utf8');
}
