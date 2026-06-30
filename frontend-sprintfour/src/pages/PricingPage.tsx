import { useTriageStore } from "@/store/useTriageStore";

export function PricingPage() {
  const { userTier, setUserTier } = useTriageStore();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-3">
          Choose your speed
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Free gets you started. Pro makes you unstoppable. Both keep your data 100% local.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Tier */}
          <div
            className={`rounded-xl border p-8 transition-all ${
              userTier === "free"
                ? "border-cyan-500/50 bg-slate-900/80 shadow-lg shadow-cyan-500/10"
                : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
            }`}
          >
            {userTier === "free" && (
              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-4">
                Current Plan
              </div>
            )}
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Free
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-sm text-slate-500">/month</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Perfect for occasional document review
            </p>

            <ul className="space-y-3 mb-8">
              {[
                { text: "5 documents per day", included: true },
                { text: "Regex-only PII detection", included: true },
                { text: "Click-based review UI", included: true },
                { text: "Standard processing queue", included: true },
                { text: "AI-enhanced detection", included: false },
                { text: "Vim Mode (keyboard triage)", included: false },
                { text: "Priority processing queue", included: false },
                { text: "Batch upload", included: false },
              ].map((feature) => (
                <li
                  key={feature.text}
                  className={`flex items-center gap-2 text-xs ${
                    feature.included ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      feature.included
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    {feature.included ? "✓" : "—"}
                  </span>
                  {feature.text}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setUserTier("free")}
              disabled={userTier === "free"}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                userTier === "free"
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {userTier === "free" ? "Current Plan" : "Downgrade to Free"}
            </button>
          </div>

          {/* Pro Tier */}
          <div
            className={`rounded-xl border p-8 relative overflow-hidden transition-all ${
              userTier === "pro"
                ? "border-violet-500/50 bg-slate-900/80 shadow-lg shadow-violet-500/10"
                : "border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-transparent hover:border-violet-500/50"
            }`}
          >
            {/* Popular badge */}
            <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-[10px] font-bold rounded-bl-lg">
              MOST POPULAR
            </div>

            {userTier === "pro" && (
              <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-4">
                Current Plan
              </div>
            )}
            <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">
              Pro
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-white">$29</span>
              <span className="text-sm text-slate-500">/month</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              For paralegals processing 100+ docs daily
            </p>

            <ul className="space-y-3 mb-8">
              {[
                { text: "Unlimited documents", highlight: true },
                { text: "AI + Regex hybrid detection", highlight: true },
                { text: "Vim Mode — keyboard triage", highlight: true },
                { text: "Priority processing queue", highlight: true },
                { text: "Click-based review UI", highlight: false },
                { text: "Batch upload (up to 50)", highlight: false },
                { text: "Export redacted documents", highlight: false },
                { text: "Processing analytics", highlight: false },
              ].map((feature) => (
                <li
                  key={feature.text}
                  className={`flex items-center gap-2 text-xs ${
                    feature.highlight ? "text-white font-medium" : "text-slate-300"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-violet-500/20 text-violet-400">
                    ✓
                  </span>
                  {feature.text}
                  {feature.highlight && (
                    <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[9px] font-bold">
                      PRO
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setUserTier("pro")}
              disabled={userTier === "pro"}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                userTier === "pro"
                  ? "bg-violet-500/20 text-violet-400 cursor-not-allowed border border-violet-500/30"
                  : "bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
              }`}
            >
              {userTier === "pro" ? "Current Plan" : "Upgrade to Pro"}
            </button>

            {/* Speed comparison micro-stat */}
            <div className="mt-6 pt-4 border-t border-violet-500/20 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Average throughput</div>
              <div className="flex items-center justify-center gap-3">
                <div>
                  <div className="text-lg font-bold text-violet-400 font-mono">3s</div>
                  <div className="text-[10px] text-slate-500">per doc</div>
                </div>
                <div className="text-slate-600">vs</div>
                <div>
                  <div className="text-lg font-bold text-red-400 font-mono line-through opacity-50">45s</div>
                  <div className="text-[10px] text-slate-500">manual</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Details */}
        <div className="mt-16">
          <h3 className="text-lg font-bold text-white text-center mb-8">Feature Comparison</h3>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Feature</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Free</th>
                  <th className="text-center py-3 px-4 text-violet-400 font-medium">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PII Detection", "Regex only", "AI + Regex hybrid"],
                  ["Documents / Day", "5", "Unlimited"],
                  ["Processing Queue", "Standard", "Priority (2x faster)"],
                  ["Triage Interface", "Click-based", "Click + Vim Mode"],
                  ["Auto-Approve", "Basic (>95%)", "Smart (>90% + AI boost)"],
                  ["Processing Time", "~1s (regex)", "~3s (regex + AI)"],
                  ["Confidence Boost", "—", "Cross-validated AI"],
                ].map(([feature, free, pro]) => (
                  <tr key={feature} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-300">{feature}</td>
                    <td className="py-3 px-4 text-center text-slate-500">{free}</td>
                    <td className="py-3 px-4 text-center text-violet-300">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
