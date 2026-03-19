import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

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
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Some Ghost ping events send empty / non-JSON bodies — that's fine
    }

    const currentSlug = payload.post?.current?.slug;

    // ── Cache Invalidation ───────────────────────────────────────────────────
    //
    // Use revalidatePath() to purge the Next.js cache. This is the proven pattern
    // from Vercel's on-demand-isr example and works reliably with webhooks.

    console.log("[Ghost Webhook] Revalidating /blog");
    revalidatePath("/blog");

    if (currentSlug) {
      console.log(`[Ghost Webhook] Revalidating /blog/${currentSlug}`);
      revalidatePath(`/blog/${currentSlug}`);
    }

    console.log("[Ghost Webhook] Success!");
    return NextResponse.json({ 
      revalidated: true, 
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Ghost Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
