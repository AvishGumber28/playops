import { BasketballMotif } from './basketball-motif';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-extrabold text-playops-amber">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </p>
    </div>
  );
}

// Left panel of the login split-screen - marketing/brand side. Hidden
// below md; the dark background itself still bleeds through on mobile
// via the page-level wrapper, only this panel's content disappears.
export function LoginHeroPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-playops-green via-[#122e22] to-black md:flex md:w-[58%] md:flex-col md:justify-between md:p-12 lg:p-16">
      <BasketballMotif className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" />

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-playops-amber text-sm font-black text-playops-charcoal">
            ▸
          </span>
          <p className="text-lg font-extrabold tracking-tight text-white">PLAYOPS</p>
        </div>
        <p className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-white/50">
          INTRAMURAL ATHLETICS
        </p>

        <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-playops-amber" />
          Spring Intramural Cup Live
        </div>

        <h1 className="mt-6 text-5xl font-black uppercase leading-[0.95] tracking-tight lg:text-6xl">
          <span className="block text-white">Compete.</span>
          <span className="block text-playops-amber">Dominate.</span>
          <span className="block text-white">Represent.</span>
        </h1>

        <p className="mt-6 max-w-sm text-sm text-white/60">
          Real-time scorekeeping, tournament brackets, and roster administration engineered
          specifically for campus leagues.
        </p>

        <div className="mt-10 grid grid-cols-3 gap-6">
          <Stat value="42+" label="Hostel Squads" />
          <Stat value="1,840" label="Active Athletes" />
          <Stat value="16" label="Varsity Sports" />
        </div>
      </div>

      <div className="relative z-10 mt-12 flex items-end justify-between border-t border-white/10 pt-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white">
            One platform. Every hostel. Every game.
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
            Official collegiate league operating system
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          System v2.4 online
        </div>
      </div>
    </aside>
  );
}
