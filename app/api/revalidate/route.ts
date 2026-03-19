import crypto from 'crypto';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  console.log('[Revalidate] ─── Webhook received ───────────────────────────');
  const body = await request.text();

  const SECRET = process.env.GHOST_WEBHOOK_SECRET;
  if (!SECRET) {
    console.error('[Revalidate] ❌ GHOST_WEBHOOK_SECRET is not set!');
    return new Response('Missing secret', { status: 500 });
  }

  const signatureHeader = request.headers.get('x-ghost-signature');
  if (!signatureHeader) {
    console.error('[Revalidate] ❌ x-ghost-signature header is missing!');
    return new Response('Missing signature.', { status: 400 });
  }

  // Extract hash and timestamp
  const receivedSig = signatureHeader.match(/sha256=([a-f0-9]+)/)?.[1] ?? '';
  const timestamp = signatureHeader.match(/t=(\d+)/)?.[1] ?? '';

  if (!receivedSig || !timestamp) {
    console.error('[Revalidate] ❌ Invalid signature format:', signatureHeader);
    return new Response('Invalid signature format.', { status: 400 });
  }

  // Ghost Signature: HMAC-SHA256(raw_body + timestamp)
  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(body + timestamp)
    .digest('hex');

  console.log('[Revalidate] Expected sig:', expectedSig);
  console.log('[Revalidate] Received sig:', receivedSig);

  const trusted   = Buffer.from(`sha256=${expectedSig}`, 'ascii');
  const untrusted = Buffer.from(`sha256=${receivedSig}`, 'ascii');

  if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
    console.error('[Revalidate] ❌ Signature mismatch — rejecting webhook.');
    return new Response('Invalid signature.', { status: 400 });
  }

  console.log('[Revalidate] ✅ Signature verified.');

  try {
    revalidateTag('posts', 'max');
    console.log('[Revalidate] ✅ revalidateTag("posts", "max") called successfully.');
  } catch (e) {
    console.error('[Revalidate] ❌ revalidateTag threw an error:', e);
    return new Response('revalidateTag failed.', { status: 500 });
  }

  console.log('[Revalidate] ─── Done ─────────────────────────────────────────');
  return new Response(JSON.stringify({ revalidated: true, at: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
