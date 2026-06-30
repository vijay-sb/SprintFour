import { useTriageStore } from "@/store/useTriageStore";
import { SystemBenchmark } from "@/components/SystemBenchmark";

const FREE_FEATURES = [
  { text: "Batch Triage workflow", included: true },
  { text: "Regex PII detection", included: true },
  { text: "Click-based document review", included: true },
  { text: "Export redacted documents", included: true },
  { text: "AI-enhanced detection", included: false },
  { text: "Vim Mode (keyboard triage)", included: false },
  { text: "Priority processing queue", included: false },
  { text: "Unlimited documents", included: false },
];

const PRO_FEATURES = [
  { text: "Unlimited documents", highlight: true },
  { text: "AI + Regex hybrid detection", highlight: true },
  { text: "Vim Mode — keyboard triage", highlight: true },
  { text: "Priority processing queue", highlight: true },
  { text: "Batch Triage workflow", highlight: false },
  { text: "Cross-document bulk decisions", highlight: false },
  { text: "Export redacted documents", highlight: false },
  { text: "Processing analytics", highlight: false },
];

const COMPARISON: Array<[string, string, string]> = [
  ["PII Detection", "Regex only", "AI + Regex hybrid"],
  ["Documents / day", "5", "Unlimited"],
  ["Processing queue", "Standard", "Priority (2x faster)"],
  ["Triage interfaces", "Batch + Document", "Batch + Document + Vim"],
  ["Auto-approve", "Basic (>95%)", "Smart (>90% + AI boost)"],
  ["Bulk class decisions", "Included", "Included"],
];

export function PricingPage() {
  const { userTier, setUserTier } = useTriageStore();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-12 pt-16 text-center">
        <h1 className="mb-3 text-4xl font-bold text-white">Choose your speed</h1>
        <p className="mx-auto max-w-lg text-sm text-slate-400">
          Free gets you started. Pro makes you unstoppable. Both keep your data 100% local.
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free */}
          <PlanCard
            active={userTier === "free"}
            accent="slate"
            name="Free"
            price="$0"
            blurb="Perfect for occasional document review"
          >
            <FeatureList
              items={FREE_FEATURES.map((f) => ({ text: f.text, on: f.included }))}
            />
            <PlanButton
              onClick={() => setUserTier("free")}
              disabled={userTier === "free"}
              tone="muted"
            >
              {userTier === "free" ? "Current plan" : "Downgrade to Free"}
            </PlanButton>
          </PlanCard>

          {/* Pro */}
          <PlanCard
            active={userTier === "pro"}
            accent="cyan"
            name="Pro"
            price="$29"
            blurb="For paralegals processing 100+ docs daily"
            badge="Most popular"
          >
            <FeatureList
              items={PRO_FEATURES.map((f) => ({ text: f.text, on: true, strong: f.highlight }))}
            />
            <PlanButton
              onClick={() => setUserTier("pro")}
              disabled={userTier === "pro"}
              tone="primary"
            >
              {userTier === "pro" ? "Current plan" : "Upgrade to Pro"}
            </PlanButton>

            <div className="mt-6 border-t border-white/10 pt-4 text-center">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                Average throughput
              </div>
              <div className="flex items-center justify-center gap-3">
                <div>
                  <div className="font-mono text-lg font-bold text-cyan-300">3s</div>
                  <div className="text-[10px] text-slate-500">per doc</div>
                </div>
                <div className="text-slate-600">vs</div>
                <div>
                  <div className="font-mono text-lg font-bold text-rose-400 line-through opacity-60">
                    45s
                  </div>
                  <div className="text-[10px] text-slate-500">manual</div>
                </div>
              </div>
            </div>
          </PlanCard>
        </div>

        {/* Live proof that Pro is prioritized */}
        <div className="mt-16">
          <h3 className="mb-2 text-center text-lg font-bold text-white">Why Pro is faster — measured</h3>
          <p className="mx-auto mb-8 max-w-xl text-center text-xs text-slate-400">
            These are live numbers from the engine: Pro documents are dequeued before Free, so they
            start sooner under load. The same run shows the pipeline's speed and de-duplication.
          </p>
          <SystemBenchmark />
        </div>

        {/* Comparison */}
        <div className="mt-16">
          <h3 className="mb-8 text-center text-lg font-bold text-white">Feature comparison</h3>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Feature</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-400">Free</th>
                  <th className="px-4 py-3 text-center font-medium text-cyan-300">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([feature, free, pro]) => (
                  <tr key={feature} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">{feature}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{free}</td>
                    <td className="px-4 py-3 text-center text-cyan-200">{pro}</td>
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

function PlanCard({
  active,
  accent,
  name,
  price,
  blurb,
  badge,
  children,
}: {
  active: boolean;
  accent: "slate" | "cyan";
  name: string;
  price: string;
  blurb: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const ring =
    active && accent === "cyan"
      ? "border-cyan-400/40 ring-1 ring-cyan-400/20"
      : active
        ? "border-white/20"
        : "border-white/10 hover:border-white/20";

  return (
    <div className={`relative rounded-xl border bg-slate-900/40 p-8 transition ${ring}`}>
      {badge ? (
        <div className="absolute right-0 top-0 rounded-bl-lg rounded-tr-xl bg-cyan-300 px-3 py-1 text-[10px] font-bold text-slate-950">
          {badge}
        </div>
      ) : null}
      {active ? (
        <div
          className={`mb-4 text-[10px] font-bold uppercase tracking-wider ${
            accent === "cyan" ? "text-cyan-300" : "text-slate-400"
          }`}
        >
          Current plan
        </div>
      ) : null}
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {name}
      </div>
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-white">{price}</span>
        <span className="text-sm text-slate-500">/month</span>
      </div>
      <p className="mb-6 text-xs text-slate-500">{blurb}</p>
      {children}
    </div>
  );
}

function FeatureList({
  items,
}: {
  items: Array<{ text: string; on: boolean; strong?: boolean }>;
}) {
  return (
    <ul className="mb-8 space-y-3">
      {items.map((item) => (
        <li
          key={item.text}
          className={`flex items-center gap-2 text-xs ${
            !item.on ? "text-slate-600" : item.strong ? "font-medium text-white" : "text-slate-300"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
              item.on ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-600"
            }`}
          >
            {item.on ? "✓" : "—"}
          </span>
          {item.text}
          {item.strong ? (
            <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
              PRO
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PlanButton({
  onClick,
  disabled,
  tone,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  tone: "primary" | "muted";
  children: React.ReactNode;
}) {
  const base = "w-full rounded-lg py-2.5 text-sm font-semibold transition";
  const styles = disabled
    ? "cursor-not-allowed bg-white/5 text-slate-500"
    : tone === "primary"
      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10";

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
