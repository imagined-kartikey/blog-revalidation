import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "crypto";

// ─── Constants ──────────────────────────────────────────────────────────────

// GHOST_WEBHOOK_SECRET is set in Ghost's Webhook integration settings
const SECRET = process.env.GHOST_WEBHOOK_SECRET;

// ─── Helper: Verify Webhook Signature ───────────────────────────────────────

/**
 * Ghost sets a header `X-Ghost-Signature: sha256={hash}, t={timestamp}`.
 * The signature is an HMAC-SHA256 hex digest of the raw body payload concatenated
 * with the timestamp (`body + timestamp`), using the webhook secret as the key.
 *
 * It is CRITICAL to verify this to prevent bad actors from triggering random
 * revalidations, saving server resources. Next.js 16 On-Demand Revalidation
 * depends on explicit triggers like this.
 */
async function verifyGhostSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  if (!SECRET) {
    console.warn("⚠️ GHOST_WEBHOOK_SECRET is missing. Webhooks will be rejected.");
    return false;
  }

  const signatureHeader = req.headers.get("x-ghost-signature");
  if (!signatureHeader) return false;

  // Header format: 'sha256=abcdef123..., t=1612345678'
  const match = signatureHeader.match(/sha256=([a-fA-F0-9]+),\s*t=(\d+)/);
  if (!match) return false;

  const [, hash, timestamp] = match;

  // Optional: check if timestamp is too old (e.g., > 5 minutes) to prevent replay attacks
  const ageInMs = Date.now() - parseInt(timestamp, 10);
  if (ageInMs > 5 * 60 * 1000) {
    console.warn("⚠️ Webhook timestamp is too old (replay attack?)");
    return false;
  }

  // Create HMAC SHA256 of payload + timestamp using our secret
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(rawBody + timestamp);
  const expectedHash = hmac.digest("hex");

  // Use timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(hash));
}

// ─── Route Handler ──────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    // 1. Get raw body for crypto verification
    const rawBody = await req.text();

    // 2. Verify signature
    const isValid = await verifyGhostSignature(req, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Trigger SWR Cache Invalidation via revalidateTag and revalidatePath
    // In Next.js 16, "max" or "updateTag" is required as the second argument.
    // We tagged all our fetch requests in lib/ghost.ts with 'posts'
    revalidateTag('posts', 'max');
    
    // Explicitly revalidate the routes to ensure Vercel Edge Cache purges the HTML
    revalidatePath('/', 'layout');

    // Return success
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (error) {
    console.error("❌ Revalidation Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
