import crypto from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // Ghost sends: X-Ghost-Signature: sha256=<hash>, t=<timestamp>
    const signatureHeader = req.headers.get("x-ghost-signature");
    if (!signatureHeader) {
      return NextResponse.json({ error: "Missing x-ghost-signature header" }, { status: 401 });
    }

    const receivedHash = signatureHeader.match(/sha256=([a-f0-9]+)/)?.[1];
    if (!receivedHash) {
      return NextResponse.json({ error: "Invalid signature format" }, { status: 401 });
    }

    // Ghost computes HMAC over the raw body only — not body+timestamp
    const expectedHash = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");

    const trusted = Buffer.from(`sha256=${expectedHash}`, "ascii");
    const untrusted = Buffer.from(`sha256=${receivedHash}`, "ascii");

    if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
      console.log("[Ghost Webhook] Invalid signature.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse slug from payload (may be undefined for ping events)
    let payload: GhostWebhookPayload = {};
    try {
      payload = JSON.parse(rawBody) as GhostWebhookPayload;
    } catch {
      // Proceed — some Ghost events send empty payloads
    }

    const currentSlug = payload.post?.current?.slug;
    const previousSlug = payload.post?.previous?.slug;

    // Invalidate via tag — "max" = stale-while-revalidate semantics (required two-arg form per Next.js docs)
    revalidateTag("blog-posts", "max");
    if (currentSlug) revalidateTag(`blog-post-${currentSlug}`, "max");
    if (previousSlug && previousSlug !== currentSlug) revalidateTag(`blog-post-${previousSlug}`, "max");

    // Invalidate via path (following Vercel's on-demand ISR example — belt-and-suspenders)
    console.log("[Ghost Webhook] Revalidating /blog");
    revalidatePath("/blog");

    if (currentSlug) {
      console.log(`[Ghost Webhook] Revalidating /blog/${currentSlug}`);
      revalidatePath(`/blog/${currentSlug}`);
    }
    if (previousSlug && previousSlug !== currentSlug) {
      console.log(`[Ghost Webhook] Revalidating /blog/${previousSlug}`);
      revalidatePath(`/blog/${previousSlug}`);
    }

    return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
  } catch (error) {
    console.error("[Ghost Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
