import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="mt-4 text-lg text-neutral-600">Page not found</p>
      <p className="mt-2 text-sm text-neutral-500">The page you're looking for doesn't exist.</p>
      <Link
        to="/app"
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90 transition-colors"
      >
        Go back home
      </Link>
    </div>
  );
}
