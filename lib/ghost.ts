import 'server-only';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GhostPost {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string | null;
  excerpt: string | null;
  feature_image: string | null;
  feature_image_alt: string | null;
  published_at: string | null;
  reading_time: number;
  tags: GhostTag[];
  authors: GhostAuthor[];
  primary_author: GhostAuthor | null;
  primary_tag: GhostTag | null;
  url: string;
  meta_title: string | null;
  meta_description: string | null;
}

export interface GhostTag {
  id: string;
  name: string;
  slug: string;
}

export interface GhostAuthor {
  id: string;
  name: string;
  slug: string;
  profile_image: string | null;
  bio: string | null;
}

interface GhostResponse<T> {
  posts?: T[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GHOST_URL = process.env.GHOST_URL!;
const GHOST_KEY = process.env.GHOST_KEY!;
const GHOST_VERSION = 'v5.0';

function ghostFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GHOST_URL}/ghost/api/content/${endpoint}/`);
  url.searchParams.set('key', GHOST_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  console.log(`[Ghost] Fetching: ${endpoint}`);

  return fetch(url.toString(), {
    headers: { 'Accept-Version': GHOST_VERSION },
  }).then((res) => {
    if (!res.ok) throw new Error(`Ghost API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  });
}

// ─── Cached Data Fetchers ─────────────────────────────────────────────────────
//
// Pattern from Vercel's official on-demand ISR example:
//   https://github.com/vercel/on-demand-isr
//
// The `'use cache'` directive caches the function's return value on the server.
// On-demand invalidation is done via revalidatePath() in the webhook route —
// which forces ALL cached functions that contributed to that path to be
// re-executed on the very next request.
//
// We intentionally do NOT use cacheTag or cacheLife here to keep it simple
// and matching the proven Vercel pattern.

export async function getPosts(limit = 20): Promise<GhostPost[]> {
  'use cache';

  const data = await ghostFetch<GhostResponse<GhostPost>>('posts', {
    limit: String(limit),
    include: 'tags,authors',
    fields:
      'id,uuid,title,slug,excerpt,feature_image,feature_image_alt,published_at,reading_time,url,meta_title,meta_description',
  });

  console.log(`[Ghost] Posts fetched: ${data.posts?.length ?? 0}`);
  return data.posts ?? [];
}

export async function getPost(slug: string): Promise<GhostPost | null> {
  'use cache';

  const data = await ghostFetch<GhostResponse<GhostPost>>(`posts/slug/${slug}`, {
    include: 'tags,authors',
  });

  console.log(`[Ghost] Post fetched: ${slug}`);
  return data.posts?.[0] ?? null;
}

export async function getAllPostSlugs(): Promise<string[]> {
  'use cache';

  const data = await ghostFetch<GhostResponse<{ slug: string }>>('posts', {
    limit: 'all',
    fields: 'slug',
  });

  return (data.posts ?? []).map((p) => p.slug);
}
