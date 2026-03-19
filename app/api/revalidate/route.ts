import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

// Mirrors the Vercel official on-demand ISR webhook pattern:
// https://github.com/vercel/on-demand-isr/blob/main/app/api/webhook/route.ts
//
// Ghost signs webhooks with HMAC-SHA256 over the RAW BODY only.
// The timestamp `t` in the X-Ghost-Signature header is for replay-attack
// prevention only — it is NOT part of the hash input.
//
// Header format:  X-Ghost-Signature: sha256=<hex>, t=<unix_ms>

export async function POST(request: Request) {
  try {
    const text = await request.text();

    const signature = crypto
      .createHmac('sha256', process.env.GHOST_WEBHOOK_SECRET || '')
      .update(text)
      .digest('hex');

    const signatureHeader = request.headers.get('x-ghost-signature') || '';

    // Extract sha256=... part from the header
    const receivedSig = signatureHeader.match(/sha256=([a-f0-9]+)/)?.[1] ?? '';

    const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
    const untrusted = Buffer.from(`sha256=${receivedSig}`, 'ascii');

    if (
      trusted.length !== untrusted.length ||
      !crypto.timingSafeEqual(trusted, untrusted)
    ) {
      console.log('[Ghost Webhook] Invalid signature.');
      return new Response('Invalid signature.', { status: 400 });
    }

    // Parse slugs from payload so we can revalidate the specific post page too
    let currentSlug: string | undefined;
    let previousSlug: string | undefined;
    try {
      const payload = JSON.parse(text);
      currentSlug = payload.post?.current?.slug;
      previousSlug = payload.post?.previous?.slug;
    } catch {
      // Not all Ghost events have a JSON body — continue anyway
    }

    // Revalidate the blog listing
    console.log('[Ghost Webhook] Revalidating /blog');
    revalidatePath('/blog');

    // Revalidate the specific post page(s)
    if (currentSlug) {
      console.log(`[Ghost Webhook] Revalidating /blog/${currentSlug}`);
      revalidatePath(`/blog/${currentSlug}`);
    }
    if (previousSlug && previousSlug !== currentSlug) {
      console.log(`[Ghost Webhook] Revalidating /blog/${previousSlug}`);
      revalidatePath(`/blog/${previousSlug}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(`Webhook error: ${msg}`, { status: 400 });
  }

  return new Response('Success!', { status: 200 });
}
