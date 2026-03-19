import crypto from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { CACHE_TAG_POSTS, postTag } from "@/lib/ghost";

interface GhostWebhookPayload {
  post?: {
    current?: { slug?: string };
    previous?: { slug?: string };
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const SECRET = process.env.GHOST_WEBHOOK_SECRET;

    if (!SECRET) {
      console.error("[Ghost Webhook] GHOST_WEBHOOK_SECRET is not set.");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // Ghost sends: X-Ghost-Signature: sha256=<hash>, t=<timestamp>
    const signatureHeader = req.headers.get("x-ghost-signature");
    if (!signatureHeader) {
      return NextResponse.json({ error: "Missing x-ghost-signature header" }, { status: 401 });
    }

    // Extract the hash and timestamp parts
    const hashMatch = signatureHeader.match(/sha256=([a-f0-9]+)/);
    const tsMatch = signatureHeader.match(/t=(\d+)/);

    if (!hashMatch || !tsMatch) {
      return NextResponse.json({ error: "Invalid signature format" }, { status: 401 });
    }

    const receivedHash = hashMatch[1];
    const timestamp = tsMatch[1];

    // Replay attack guard — reject webhooks older than 5 minutes
    const ageMs = Date.now() - parseInt(timestamp, 10);
    if (ageMs > 5 * 60 * 1000) {
      console.warn("[Ghost Webhook] Rejected stale webhook (replay attack?)");
      return NextResponse.json({ error: "Webhook timestamp too old" }, { status: 401 });
    }

    // Ghost computes HMAC-SHA256 over body+timestamp concatenated
    const expectedHash = crypto
      .createHmac("sha256", SECRET)
      .update(rawBody + timestamp)
      .digest("hex");

    const trusted = Buffer.from(expectedHash, "hex");
    const untrusted = Buffer.from(receivedHash, "hex");

    if (
      trusted.length !== untrusted.length ||
      !crypto.timingSafeEqual(trusted, untrusted)
    ) {
      console.log("[Ghost Webhook] Signature mismatch — rejected.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse slug from payload (may be absent for ping events)
    let payload: GhostWebhookPayload = {};
    try {
      payload = JSON.parse(rawBody) as GhostWebhookPayload;
    } catch {
      // Some Ghost ping events send empty / non-JSON bodies — that's fine
    }

    const currentSlug = payload.post?.current?.slug;
    const previousSlug = payload.post?.previous?.slug;

    // ── Cache Invalidation ───────────────────────────────────────────────────
    //
    // We use the SAME tag constants exported from lib/ghost.ts so there can
    // never be a mismatch between what was tagged and what gets revalidated.
    //
    // revalidateTag(tag, 'max') = SWR: serve stale immediately, regenerate in background.
    // This matches cacheLife({ stale: 0, revalidate: 3600 }) in ghost.ts.

    console.log(`[Ghost Webhook] Invalidating tag: ${CACHE_TAG_POSTS}`);
    revalidateTag(CACHE_TAG_POSTS, "max");

    // Also invalidate any per-slug tags
    if (currentSlug) {
      console.log(`[Ghost Webhook] Invalidating tag: ${postTag(currentSlug)}`);
      revalidateTag(postTag(currentSlug), "max");
    }
    if (previousSlug && previousSlug !== currentSlug) {
      console.log(`[Ghost Webhook] Invalidating tag: ${postTag(previousSlug)}`);
      revalidateTag(postTag(previousSlug), "max");
    }

    // Belt-and-suspenders: also revalidate by path so static HTML on the
    // Vercel CDN edge is purged as well (belt-and-suspenders approach).
    revalidatePath("/blog", "layout");

    console.log("[Ghost Webhook] Revalidation complete.");
    return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
  } catch (error) {
    console.error("[Ghost Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
