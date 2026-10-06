import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-violet-50 text-center">
      <p className="text-3xl font-semibold text-violet-900">404</p>
      <p className="text-sm text-violet-600">Page not found.</p>
      <Link to="/login" className="mt-4 text-sm font-medium text-violet-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
