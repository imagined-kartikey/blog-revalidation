import { cacheLife, cacheTag } from 'next/cache';

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

// ─── Fetch helper ─────────────────────────────────────────────────────────────

const GHOST_URL = process.env.GHOST_URL!;
const GHOST_KEY = process.env.GHOST_KEY!;

async function ghostFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${GHOST_URL}/ghost/api/content/${endpoint}/`);
  url.searchParams.set('key', GHOST_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { 'Accept-Version': 'v5.0' },
  });

  if (!res.ok) {
    throw new Error(`Ghost API error ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─── Cached data functions ────────────────────────────────────────────────────
//
// Pattern per Next.js 16 docs (cacheComponents: true):
//   'use cache'   → cache this function's return value on the server
//   cacheLife()   → time-based fallback (SWR: serve stale, refresh in bg)
//   cacheTag()    → tag entries so revalidateTag('posts', 'max') can purge them
//
// On-demand invalidation flow:
//   Ghost event → POST /api/revalidate → revalidateTag('posts', 'max')
//   → Next request serves fresh data from Ghost in the background
//

export async function getPosts(limit = 20): Promise<GhostPost[]> {
  'use cache';
  cacheLife('hours'); // stale: 5m | revalidate: 1h | expire: 1d
  cacheTag('posts');  // <-- matches revalidateTag('posts', 'max') in webhook

  const data = await ghostFetch<GhostResponse<GhostPost>>('posts', {
    limit: String(limit),
    include: 'tags,authors',
    fields: 'id,uuid,title,slug,excerpt,feature_image,feature_image_alt,published_at,reading_time,url,meta_title,meta_description',
  });

  console.log(`[Ghost] getPosts → ${data.posts?.length ?? 0} posts`);
  return data.posts ?? [];
}

export async function getPost(slug: string): Promise<GhostPost | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('posts', `post-${slug}`); // broad + narrow tags both tagged

  const data = await ghostFetch<GhostResponse<GhostPost>>(`posts/slug/${slug}`, {
    include: 'tags,authors',
  });

  console.log(`[Ghost] getPost(${slug}) → ${data.posts?.[0] ? 'found' : 'not found'}`);
  return data.posts?.[0] ?? null;
}

export async function getAllPostSlugs(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('posts');

  const data = await ghostFetch<GhostResponse<{ slug: string }>>('posts', {
    limit: 'all',
    fields: 'slug',
  });

  return (data.posts ?? []).map((p) => p.slug);
}
