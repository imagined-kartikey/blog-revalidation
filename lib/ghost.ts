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

// ─── Cached Data Fetchers ─────────────────────────────────────────────────────

/**
 * Fetch latest posts from Ghost.
 * Cached with SWR: stale for up to 1 hour, revalidates in the background.
 * Tagged 'posts' so Ghost webhooks can invalidate on-demand.
 */
export async function getPosts(limit = 20): Promise<GhostPost[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts");

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
 * Cached: stale for up to 1 hour, tagged 'posts' AND 'post-{slug}'.
 */
export async function getPost(slug: string): Promise<GhostPost | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts", `post-${slug}`);

  const data = await ghostFetch<GhostResponse<GhostPost>>(`posts/slug/${slug}`, {
    include: "tags,authors",
  });

  return data.posts?.[0] ?? null;
}

/**
 * Fetch all post slugs — used for generateStaticParams.
 * Also cached + tagged so revalidation can flush this too.
 */
export async function getAllPostSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts");

  const data = await ghostFetch<GhostResponse<{ slug: string }>>("posts", {
    limit: "all",
    fields: "slug",
  });

  return (data.posts ?? []).map((p) => p.slug);
}
