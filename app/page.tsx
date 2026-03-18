import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container">
      <section className="hero">
        <span className="hero__eyebrow">Architecture Demo</span>
        <h1 className="hero__title">
          Next.js 16 <span>SWR Revalidation</span>
        </h1>
        <p className="hero__sub">
          A high-performance blog using Ghost CMS and Next.js 16's experimental <code>dynamicIO</code> feature. 
          Pages are served from cache instantly, while webhooks trigger on-demand background revalidation using <code>revalidateTag</code>.
        </p>
        <div className="mt-8">
          <Link href="/blog" className="hero__cta">
            Enter Blog
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </section>

      <div className="container--narrow py-16">
        <div className="post-content bg-surface p-8 rounded-xl border border-surface-border shadow-card mb-12">
          <h3>How it works</h3>
          <ol>
            <li><strong>Data Fetching:</strong> Ghost API calls use <code>use cache</code> + <code>cacheLife('hours')</code> to stay fast.</li>
            <li><strong>Tags:</strong> Fetch calls are tagged with <code>cacheTag('posts')</code>.</li>
            <li><strong>Webhooks:</strong> When you publish/edit a post in Ghost, it sends a webhook to <code>/api/revalidate</code>.</li>
            <li><strong>Security:</strong> The route verifies Ghost's HMAC-SHA256 <code>X-Ghost-Signature</code> using the secret.</li>
            <li><strong>Invalidation:</strong> If valid, it runs <code>revalidateTag('posts')</code>, purging the stale data so the <em>next</em> request is served fresh.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
