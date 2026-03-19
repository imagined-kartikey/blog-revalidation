import crypto from 'crypto';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const body = await request.text();

  // Verify Ghost webhook signature (HMAC-SHA256 over raw body)
  const expectedSig = crypto
    .createHmac('sha256', process.env.GHOST_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex');

  const receivedSig = request.headers
    .get('x-ghost-signature')
    ?.match(/sha256=([a-f0-9]+)/)?.[1] ?? '';

  const trusted   = Buffer.from(`sha256=${expectedSig}`, 'ascii');
  const untrusted = Buffer.from(`sha256=${receivedSig}`, 'ascii');

  if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
    return new Response('Invalid signature.', { status: 400 });
  }

  // Purge the 'posts' cache — matches cacheTag('posts') in lib/ghost.ts
  revalidateTag('posts', 'max');

  return new Response('OK', { status: 200 });
}
