import { getPost, getAllPostSlugs } from '@/lib/ghost';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  return {
    title: post.meta_title || `${post.title} | Imagined Studio`,
    description: post.meta_description || post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Draft';

  return (
    <article>
      <header className="post-hero">
        <Link href="/blog" className="post-hero__back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Blog
        </Link>
        
        {post.tags && post.tags.length > 0 && (
          <div className="post-hero__tags">
            {post.tags.map(tag => (
              <span key={tag.id} className="post-card__tag">{tag.name}</span>
            ))}
          </div>
        )}
        
        <h1 className="post-hero__title">{post.title}</h1>
        {post.excerpt && <p className="post-hero__excerpt">{post.excerpt}</p>}
        
        <div className="post-hero__meta">
          <div className="post-hero__author">
            <div className="post-hero__avatar">
              {post.primary_author?.name.charAt(0) || 'G'}
            </div>
            {post.primary_author?.name || 'Ghost'}
          </div>
          <span className="post-hero__divider">•</span>
          <time dateTime={post.published_at || ''}>{date}</time>
          <span className="post-hero__divider">•</span>
          <span>{post.reading_time} min read</span>
        </div>

        {post.feature_image && (
          <figure className="post-hero__cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.feature_image} alt={post.feature_image_alt || post.title} />
          </figure>
        )}
      </header>

      <div className="post-content">
        {post.html ? (
          <div dangerouslySetInnerHTML={{ __html: post.html }} />
        ) : (
          <p>No content available for this post.</p>
        )}
      </div>
    </article>
  );
}
