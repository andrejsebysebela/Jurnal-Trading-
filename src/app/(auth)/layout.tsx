import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line/60 bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-40 top-1/3 size-[520px] rounded-full bg-gold/[0.06] blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Performance terminal</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-fg">Turn your trading history into an edge you can measure.</h1>
          <ul className="mt-8 space-y-3 text-sm text-fg-2">
            {["Decimal-exact P&L, R-multiples and drawdown", "Strategy, instrument and time-of-day analytics", "Daily journal, playbook and rule tracking", "Prop firm limit monitoring"].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-gold" />{t}</li>
            ))}
          </ul>
        </div>
        <svg viewBox="0 0 400 80" className="relative w-full max-w-md" aria-hidden>
          <path d="M0 64 C40 60 60 50 90 54 S150 30 180 36 230 18 260 26 320 8 400 4" fill="none" stroke="#C6A15B" strokeWidth="1.5" opacity=".8" />
          <path d="M0 64 C40 60 60 50 90 54 S150 30 180 36 230 18 260 26 320 8 400 4 V80 H0Z" fill="url(#g)" opacity=".25" />
          <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#C6A15B" /><stop offset="1" stopColor="#C6A15B" stopOpacity="0" /></linearGradient></defs>
        </svg>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo /></div>
          {children}
        </div>
      </section>
    </div>
  );
}
