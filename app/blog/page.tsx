import { getPosts } from "@/lib/ghost";
import Link from "next/link";

export const metadata = {
  title: "Blog | Imagined Studio",
  description: "Latest thoughts and tutorials.",
};

export default async function BlogIndexPage() {
  const posts = await getPosts();

  return (
    <div className="posts-section container">
      <header className="section-header">
        <h1 className="section-title">Latest Articles</h1>
        <span className="section-count">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
      </header>

      {posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📝</div>
          <h2 className="empty-state__title">No posts found</h2>
          <p className="empty-state__sub">
            Create your first post in Ghost to see it here.
          </p>
        </div>
      ) : (
        <div className="posts-grid">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="post-card"
            >
              <div className="post-card__image">
                {post.feature_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.feature_image}
                    alt={post.feature_image_alt || post.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="post-card__image-placeholder">
                    <span>✍️</span>
                  </div>
                )}
              </div>
              <div className="post-card__body">
                {post.primary_tag && (
                  <div className="post-card__tags">
                    <span className="post-card__tag">
                      {post.primary_tag.name}
                    </span>
                  </div>
                )}
                <h2 className="post-card__title">{post.title}</h2>
                <p className="post-card__excerpt">{post.excerpt}</p>
                <div className="post-card__meta">
                  <div className="post-card__author">
                    <div className="post-card__avatar">
                      {post.primary_author?.name.charAt(0) || "G"}
                    </div>
                    {post.primary_author?.name || "Ghost"}
                  </div>
                  <span className="post-card__read-time">
                    {post.reading_time} min read
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
