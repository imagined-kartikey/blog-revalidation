import { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: 'Blog Demo | On-Demand SWR Revalidation',
  description: 'Ghost + Next.js SWR Revalidation Demo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav__inner">
            <Link href="/" className="nav__brand">
              Imagined Studio
            </Link>
            <div className="nav__links">
              <Link href="/blog" className="nav__link">
                Blog
              </Link>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="nav__link">
                GitHub
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="footer">
          <p>
            Built with Next.js 16 <code>use cache</code> and Ghost CMS.{' '}
            <a href="https://nextjs.org/docs/app/api-reference/directives/use-cache">Learn more</a>.
          </p>
        </footer>
      </body>
    </html>
  );
}
