import { Link, useLocation } from "react-router-dom";
import { useTriageStore } from "@/store/useTriageStore";

export function Navbar() {
  const location = useLocation();
  const { userTier } = useTriageStore();

  const links = [
    { to: "/", label: "Home" },
    { to: "/process", label: "Process" },
    { to: "/benchmarks", label: "Benchmarks" },
    { to: "/pricing", label: "Pricing" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Brand */}
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 transition group-hover:bg-neutral-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wide text-neutral-900">
            Conseal<span className="text-neutral-400">.ai</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* User Tier Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
              userTier === "pro"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                userTier === "pro" ? "bg-white" : "bg-neutral-400"
              }`}
            />
            {userTier === "pro" ? "PRO" : "FREE"}
          </div>
          {userTier === "free" && (
            <Link
              to="/pricing"
              className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-700"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
