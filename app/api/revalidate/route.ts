import crypto from 'crypto';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  console.log('[Revalidate] ─── Webhook received ───────────────────────────');
  console.log('[Revalidate] Time:', new Date().toISOString());
  console.log('[Revalidate] URL:', request.url);
  console.log('[Revalidate] Method:', request.method);

  // Log all incoming headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  console.log('[Revalidate] Headers:', JSON.stringify(headers, null, 2));

  const body = await request.text();
  console.log('[Revalidate] Raw body length:', body.length);
  console.log('[Revalidate] Raw body (first 500 chars):', body.slice(0, 500));

  // ── Signature verification ────────────────────────────────────────────────

  const SECRET = process.env.GHOST_WEBHOOK_SECRET;
  console.log('[Revalidate] SECRET set?', !!SECRET, '| SECRET length:', SECRET?.length ?? 0);

  const signatureHeader = request.headers.get('x-ghost-signature');
  console.log('[Revalidate] x-ghost-signature header:', signatureHeader);

  if (!SECRET) {
    console.error('[Revalidate] ❌ GHOST_WEBHOOK_SECRET is not set in environment!');
    return new Response('Server misconfiguration: missing secret', { status: 500 });
  }

  if (!signatureHeader) {
    console.error('[Revalidate] ❌ x-ghost-signature header is missing!');
    return new Response('Missing x-ghost-signature header.', { status: 400 });
  }

  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(body)
    .digest('hex');

  const receivedSig = signatureHeader.match(/sha256=([a-f0-9]+)/)?.[1] ?? '';

  console.log('[Revalidate] Expected sig:', expectedSig);
  console.log('[Revalidate] Received sig:', receivedSig);
  console.log('[Revalidate] Sigs match?', expectedSig === receivedSig);

  const trusted   = Buffer.from(`sha256=${expectedSig}`, 'ascii');
  const untrusted = Buffer.from(`sha256=${receivedSig}`, 'ascii');

  if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
    console.error('[Revalidate] ❌ Signature mismatch — rejecting webhook.');
    return new Response('Invalid signature.', { status: 400 });
  }

  console.log('[Revalidate] ✅ Signature verified.');

  // ── Parse payload ─────────────────────────────────────────────────────────

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(body);
    console.log('[Revalidate] Parsed payload keys:', Object.keys(payload));
    const post = payload.post as Record<string, unknown> | undefined;
    console.log('[Revalidate] post.current:', JSON.stringify(post?.current ?? null));
    console.log('[Revalidate] post.previous:', JSON.stringify(post?.previous ?? null));
  } catch (e) {
    console.warn('[Revalidate] Could not parse body as JSON:', e);
  }

  // ── Cache invalidation ────────────────────────────────────────────────────

  console.log('[Revalidate] Calling revalidateTag("posts", "max")...');
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
