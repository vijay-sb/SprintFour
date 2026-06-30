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
    <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-shadow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wide text-slate-100">
            Conseal<span className="text-cyan-400">.ai</span>
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
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  isActive
                    ? "bg-slate-800 text-cyan-400 shadow-inner"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              userTier === "pro"
                ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border-violet-500/40 text-violet-300 shadow-lg shadow-violet-500/10"
                : "bg-slate-800/50 border-slate-700 text-slate-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                userTier === "pro" ? "bg-violet-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            {userTier === "pro" ? "PRO" : "FREE"}
          </div>
          {userTier === "free" && (
            <Link
              to="/pricing"
              className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-md hover:from-violet-500 hover:to-cyan-500 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
