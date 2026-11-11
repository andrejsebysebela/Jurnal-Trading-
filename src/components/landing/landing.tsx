"use client";
import { ArrowRight, BarChart3, CalendarDays, ChevronDown, Layers, Orbit } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

// three.js is only downloaded on this page, after hydration.
const LandingScene = dynamic(() => import("./scene"), { ssr: false });

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Fades/slides children in when they enter the viewport (instant with reduced motion). */
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("transition-all duration-1000 ease-out motion-reduce:transition-none", shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-8 opacity-0 blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0", className)}
    >
      {children}
    </div>
  );
}

function Glass({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-white/[0.07] bg-[#0E1117]/55 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8", className)}>{children}</div>;
}

function Section({ children, align = "left", id }: { children: React.ReactNode; align?: "left" | "right" | "center"; id?: string }) {
  return (
    <section id={id} className={cn("relative flex min-h-[100svh] items-center px-5 py-24 sm:px-10 lg:px-20", align === "right" && "justify-end", align === "center" && "justify-center text-center")}>
      {align === "center" && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_50%_45%,rgba(9,11,15,0.9),rgba(9,11,15,0.55)_55%,transparent_80%)]" />}
      <div className="relative w-full max-w-xl">{children}</div>
    </section>
  );
}

function Kicker({ icon: Icon, children }: { icon: typeof Layers; children: React.ReactNode }) {
  return <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold"><Icon className="size-3.5" />{children}</p>;
}

export function Landing() {
  const { t, f } = useI18n();
  const L = t.landing;
  const progress = useRef(0);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onMq);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.current = max > 0 ? window.scrollY / max : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); mq.removeEventListener("change", onMq); };
  }, []);

  const sampleKpis = [
    { label: t.stats.winRate, value: f.pct("58.3"), tone: "text-fg" },
    { label: t.stats.avgR, value: f.r("0.84"), tone: "text-profit" },
    { label: t.stats.profitFactor, value: f.num("1.92", 2, 2), tone: "text-profit" },
    { label: t.stats.maxDrawdown, value: f.pct("3.4"), tone: "text-loss" },
  ];

  return (
    <div className="relative bg-bg text-fg">
      {/* 3D background */}
      <div className="fixed inset-0 z-0" aria-hidden>
        {webgl ? <LandingScene progress={progress} reduced={reduced} /> : null}
        {/* Fallback / loading backdrop */}
        <div className={cn("absolute inset-0 transition-opacity duration-1000", webgl ? "pointer-events-none opacity-0" : "opacity-100")}
          style={{ background: "radial-gradient(60% 50% at 70% 30%, rgba(198,161,91,0.16), transparent 70%), radial-gradient(40% 40% at 20% 80%, rgba(57,185,128,0.08), transparent 70%), #090B0F" }} />
        {/* phones: the copy spans the full width, so dim the whole scene */}
        <div className="pointer-events-none absolute inset-0 bg-bg/60 sm:hidden" />
        {/* left scrim keeps left-aligned copy readable over the scene */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,15,0.82)_0%,rgba(9,11,15,0.45)_32%,transparent_58%)]" />
        {/* readability vignette */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_40%,rgba(9,11,15,0.75)_100%)]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 bg-gradient-to-b from-bg/90 to-transparent px-5 sm:px-10">
        <Link href="/" aria-label="EDGELOG"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <div className="hidden sm:block"><LanguageSwitcher compact /></div>
          <Button asChild variant="ghost" size="sm"><Link href="/login">{L.signIn}</Link></Button>
          <Button asChild variant="primary" size="sm"><Link href="/signup">{L.start}</Link></Button>
        </nav>
      </header>

      <main className="relative z-10">
        <Section>
          <Reveal><p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">{L.hero.eyebrow}</p></Reveal>
          <Reveal delay={120}>
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
              {L.hero.title1}<br />
              <span className="bg-gradient-to-r from-[#F1D49A] via-gold to-[#8a6a32] bg-clip-text text-transparent">{L.hero.title2}</span>
            </h1>
          </Reveal>
          <Reveal delay={240}><p className="mt-6 max-w-lg text-base leading-relaxed text-fg-2 sm:text-lg">{L.hero.body}</p></Reveal>
          <Reveal delay={360}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg"><Link href="/signup">{L.start}<ArrowRight /></Link></Button>
              <Button asChild variant="secondary" size="lg"><Link href="/login">{L.signIn}</Link></Button>
            </div>
          </Reveal>
          <div className="mt-14 flex items-center gap-2 text-xs text-muted motion-safe:animate-pulse"><ChevronDown className="size-4" />{L.scroll}</div>
        </Section>

        <Section align="right">
          <Reveal>
            <Glass>
              <Kicker icon={Layers}>{L.journal.kicker}</Kicker>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{L.journal.title}</h2>
              <p className="mt-4 leading-relaxed text-fg-2">{L.journal.body}</p>
              <ul className="mt-5 space-y-2 text-sm text-fg-2">
                {L.journal.points.map((p) => <li key={p} className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-gold" />{p}</li>)}
              </ul>
              <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-line bg-bg/60 p-3 text-center text-xs">
                <div><p className="text-muted">{t.trade.result}</p><p className="num mt-1 font-semibold text-profit">{f.money("250", "USD", { sign: true })}</p></div>
                <div><p className="text-muted">{t.trade.rMultiple}</p><p className="num mt-1 font-semibold text-profit">{f.r("2.5")}</p></div>
                <div><p className="text-muted">{t.trade.duration}</p><p className="num mt-1 font-semibold">{f.duration(9000)}</p></div>
              </div>
            </Glass>
          </Reveal>
        </Section>

        <Section>
          <Reveal>
            <Glass>
              <Kicker icon={BarChart3}>{L.stats.kicker}</Kicker>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{L.stats.title}</h2>
              <p className="mt-4 leading-relaxed text-fg-2">{L.stats.body}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {sampleKpis.map((k) => (
                  <div key={k.label} className="rounded-xl border border-line bg-bg/60 px-4 py-3">
                    <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">{k.label}</p>
                    <p className={cn("num mt-1 text-xl font-semibold", k.tone)}>{k.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted">{L.sample}</p>
            </Glass>
          </Reveal>
        </Section>

        <Section align="right">
          <Reveal>
            <Glass>
              <Kicker icon={CalendarDays}>{L.calendar.kicker}</Kicker>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{L.calendar.title}</h2>
              <p className="mt-4 leading-relaxed text-fg-2">{L.calendar.body}</p>
            </Glass>
          </Reveal>
        </Section>

        <Section>
          <Reveal>
            <Glass>
              <Kicker icon={Orbit}>{L.accounts.kicker}</Kicker>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{L.accounts.title}</h2>
              <p className="mt-4 leading-relaxed text-fg-2">{L.accounts.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(["challenge", "verification", "funded", "live", "demo"] as const).map((p) => (
                  <span key={p} className={cn("rounded-full border px-3 py-1 text-xs", p === "funded" ? "border-profit/40 text-profit" : "border-gold/40 text-gold")}>{t.account.phase[p]}</span>
                ))}
              </div>
            </Glass>
          </Reveal>
        </Section>

        <Section align="center">
          <Reveal>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{L.final.title}</h2>
            <p className="mx-auto mt-5 max-w-md leading-relaxed text-fg-2">{L.final.body}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="primary" size="lg"><Link href="/signup">{L.start}<ArrowRight /></Link></Button>
              <Button asChild variant="secondary" size="lg"><Link href="/login">{L.signIn}</Link></Button>
            </div>
          </Reveal>
        </Section>

        <footer className="relative px-5 pb-10 text-center text-xs text-muted">
          <div className="mb-3 flex justify-center sm:hidden"><LanguageSwitcher /></div>
          {fill(L.footer, { year: new Date().getFullYear() })}
        </footer>
      </main>
    </div>
  );
}
