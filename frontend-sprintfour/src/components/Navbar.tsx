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
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Brand */}
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-300 transition group-hover:bg-cyan-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04111d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wide text-foreground">
            Conseal<span className="text-cyan-300">.ai</span>
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
                    ? "bg-white/8 text-cyan-200"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-white/5 text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                userTier === "pro" ? "bg-cyan-300" : "bg-muted-foreground"
              }`}
            />
            {userTier === "pro" ? "PRO" : "FREE"}
          </div>
          {userTier === "free" && (
            <Link
              to="/pricing"
              className="rounded-md bg-cyan-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
