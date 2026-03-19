import { cacheLife, cacheTag } from "next/cache";

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
  meta?: {
    pagination: {
      total: number;
      pages: number;
      page: number;
      limit: number;
    };
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GHOST_URL = process.env.GHOST_URL!;
const GHOST_KEY = process.env.GHOST_KEY!;
const GHOST_VERSION = "v5.0";

function ghostFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GHOST_URL}/ghost/api/content/${endpoint}/`);
  url.searchParams.set("key", GHOST_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  return fetch(url.toString(), {
    headers: { "Accept-Version": GHOST_VERSION },
  }).then((res) => {
    if (!res.ok) throw new Error(`Ghost API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  });
}

// ─── Cache Tag Constants ───────────────────────────────────────────────────────
//
// IMPORTANT: these must match exactly what is passed to revalidateTag() in
// app/api/revalidate/route.ts — a mismatch means the webhook fires but nothing updates.
//
export const CACHE_TAG_POSTS = "posts";
export function postTag(slug: string) {
  return `post-${slug}`;
}

// ─── Cached Data Fetchers ─────────────────────────────────────────────────────

/**
 * Fetch all published posts from Ghost.
 *
 * "use cache" stores the result on the server.
 * cacheLife: stale=0 prevents the Next.js App Router from holding stale
 *   snapshots in the browser for 5 minutes — without this, webhooks clear the
 *   server cache but normal page refreshes still hit the browser's own router cache.
 *
 * Tagged with CACHE_TAG_POSTS ('posts') so a single revalidateTag('posts', 'max')
 * call from the Ghost webhook purges this AND getAllPostSlugs simultaneously.
 */
export async function getPosts(limit = 20): Promise<GhostPost[]> {
  "use cache";
  cacheLife({
    stale: 0,         // Never serve stale from the browser Router Cache
    revalidate: 3600, // Regenerate on the server after 1 hour (SWR)
    expire: 86400,    // Drop the server cache entry after 1 day of no traffic
  });
  cacheTag(CACHE_TAG_POSTS);

  const data = await ghostFetch<GhostResponse<GhostPost>>("posts", {
    limit: String(limit),
    include: "tags,authors",
    fields:
      "id,uuid,title,slug,excerpt,feature_image,feature_image_alt,published_at,reading_time,url,meta_title,meta_description",
  });

  return data.posts ?? [];
}

/**
 * Fetch a single post by slug from Ghost.
 *
 * Tagged with both CACHE_TAG_POSTS ('posts') AND a per-slug tag ('post-{slug}').
 * The webhook always invalidates the broad 'posts' tag, which covers this too.
 */
export async function getPost(slug: string): Promise<GhostPost | null> {
  "use cache";
  cacheLife({
    stale: 0,
    revalidate: 3600,
    expire: 86400,
  });
  cacheTag(CACHE_TAG_POSTS, postTag(slug));

  const data = await ghostFetch<GhostResponse<GhostPost>>(`posts/slug/${slug}`, {
    include: "tags,authors",
  });

  return data.posts?.[0] ?? null;
}

/**
 * Fetch all post slugs — used by generateStaticParams.
 * Also tagged with CACHE_TAG_POSTS so the same webhook purges this too.
 */
export async function getAllPostSlugs(): Promise<string[]> {
  "use cache";
  cacheLife({
    stale: 0,
    revalidate: 3600,
    expire: 86400,
  });
  cacheTag(CACHE_TAG_POSTS);

  const data = await ghostFetch<GhostResponse<{ slug: string }>>("posts", {
    limit: "all",
    fields: "slug",
  });

  return (data.posts ?? []).map((p) => p.slug);
}
