import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong animate-pop-in w-full max-w-sm !rounded-[32px] p-10 text-center">
        <p className="text-gradient text-7xl font-semibold tracking-tight">404</p>
        <p className="mt-3 text-base font-medium text-ink">Page not found</p>
        <p className="mt-1 text-sm text-ink-3">The page you are looking for does not exist or has moved.</p>
        <Link to="/login" className="lg-btn lg-btn-primary mt-7">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
