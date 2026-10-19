import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="container page center">
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link className="btn btn-primary" href="/">
        Back home
      </Link>
    </section>
  );
}
