import { Link } from "react-router-dom";
import { useTriageStore } from "@/store/useTriageStore";

export function LandingPage() {
  const { userTier } = useTriageStore();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-card border border-border text-xs text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 bg-secondary" />
            AI-Powered PII Detection Engine
            <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold">v2.0</span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
            Redact 200 documents
            <br />
            <span className="text-primary">
              before lunch.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Conseal uses local AI + regex to detect and redact PII from legal documents in seconds.
            No data leaves your machine. HIPAA-aware. Built for paralegals who need speed.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/process"
              className="group px-6 py-3 bg-primary text-primary-foreground font-semibold hover:-translate-y-0.5 transition-transform text-sm"
            >
              Start Processing
              <span className="inline-block ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              to="/pricing"
              className="px-6 py-3 bg-card text-foreground font-medium border border-border hover:bg-muted transition-colors text-sm"
            >
              View Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: "🔒", label: "Zero Data Exfiltration", desc: "100% local processing" },
              { icon: "🏥", label: "HIPAA-Aware", desc: "Medical PII detection" },
              { icon: "⚡", label: "< 1s Regex Pass", desc: "Instant first results" },
              { icon: "🤖", label: "Local AI Engine", desc: "Ollama-powered deep scan" },
            ].map((signal) => (
              <div key={signal.label} className="text-center">
                <div className="text-2xl mb-2">{signal.icon}</div>
                <div className="text-xs font-semibold text-foreground">{signal.label}</div>
                <div className="text-[11px] text-muted-foreground">{signal.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Speed Comparison */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Speed matters when compliance is on the line</h2>
          <p className="text-muted-foreground text-sm">Side-by-side: manual review vs Conseal Triage Engine</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Manual */}
          <div className="border border-border bg-card p-6">
            <div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-4">Manual Review</div>
            <div className="text-4xl font-bold text-destructive mb-2 font-mono">45s</div>
            <div className="text-sm text-muted-foreground mb-4">per document, per reviewer</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-destructive">✗</span> Read entire document</li>
              <li className="flex items-center gap-2"><span className="text-destructive">✗</span> Ctrl+F for each PII type</li>
              <li className="flex items-center gap-2"><span className="text-destructive">✗</span> Manual highlighting</li>
              <li className="flex items-center gap-2"><span className="text-destructive">✗</span> Human error rate: ~12%</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground">200 docs × 45s =</div>
              <div className="text-lg font-bold text-destructive font-mono">2.5 hours</div>
            </div>
          </div>

          {/* Conseal */}
          <div className="border border-border bg-card p-6 relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold">RECOMMENDED</div>
            <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4">Conseal Engine</div>
            <div className="text-4xl font-bold text-secondary mb-2 font-mono">3s</div>
            <div className="text-sm text-muted-foreground mb-4">per document, AI-assisted</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Batch triage across all files at once</li>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> One decision redacts a name everywhere</li>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Vim-mode keyboard triage</li>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Auto-approve @ 90%+ confidence</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground">200 docs × 3s =</div>
              <div className="text-lg font-bold text-secondary font-mono">10 minutes</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">Three steps. Zero friction.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload",
                desc: "Drop your PDF or text file. We extract the content locally — nothing leaves your machine.",
              },
              {
                step: "02",
                title: "AI Scans",
                desc: "Regex runs instantly, then our local AI model analyzes every sentence for PII patterns.",
              },
              {
                step: "03",
                title: "You Sweep",
                desc: "Approve whole classes of PII across every file at once, handle the few edge cases, and export the entire batch in one click.",
              },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="text-6xl font-bold text-primary opacity-20 group-hover:opacity-40 transition-opacity">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-foreground mt-2 mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              quote: "Cut my document review time by 15x. I process the entire morning batch before my coffee gets cold.",
              name: "Maya Chen",
              role: "Senior Paralegal, Sterling & Associates",
            },
            {
              quote: "The Vim mode is a game-changer. Once you learn j/k/y/x, there's no going back to clicking.",
              name: "David Park",
              role: "Legal Operations, Nexus Law Group",
            },
            {
              quote: "Our compliance team finally stopped worrying about missed SSNs in discovery documents.",
              name: "Sarah Walsh",
              role: "Compliance Officer, MedCore Health",
            },
          ].map((t) => (
            <div key={t.name} className="border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground italic leading-relaxed mb-4">"{t.quote}"</div>
              <div className="text-xs font-semibold text-foreground">{t.name}</div>
              <div className="text-[11px] text-muted-foreground">{t.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to redact at the speed of thought?</h2>
          <p className="text-muted-foreground text-sm mb-8">
            {userTier === "pro"
              ? "You're on the Pro plan. Start processing documents now."
              : "Start free — upgrade to Pro for Vim Mode, AI detection, and priority processing."}
          </p>
          <Link
            to="/process"
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold hover:-translate-y-0.5 transition-transform text-sm"
          >
            Process Documents →
          </Link>
        </div>
      </section>
    </div>
  );
}
