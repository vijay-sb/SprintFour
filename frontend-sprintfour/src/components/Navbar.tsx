import { Link, useLocation } from "react-router-dom";
import { useTriageStore } from "@/store/useTriageStore";

export function Navbar() {
  const location = useLocation();
  const { userTier } = useTriageStore();

  const links = [
    { to: "/", label: "Home" },
    { to: "/process", label: "Process" },
    { to: "/pricing", label: "Pricing" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-primary flex items-center justify-center transition-shadow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wide text-foreground">
            Conseal<span className="text-primary">.ai</span>
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
                className={`px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border transition-all ${
              userTier === "pro"
                ? "bg-accent text-accent-foreground border-border"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 ${
                userTier === "pro" ? "bg-accent-foreground" : "bg-muted-foreground"
              }`}
            />
            {userTier === "pro" ? "PRO" : "FREE"}
          </div>
          {userTier === "free" && (
            <Link
              to="/pricing"
              className="px-3 py-1 text-xs font-medium bg-accent text-accent-foreground hover:-translate-y-0.5 transition-transform"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
