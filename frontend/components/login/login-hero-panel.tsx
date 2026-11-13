import Image from 'next/image';
import { Play, Calendar, Trophy } from 'lucide-react';

const TAGS = [
  { icon: Play, label: 'Play', iconClassName: 'text-playops-amber' },
  { icon: Calendar, label: 'Book', iconClassName: 'text-emerald-400' },
  { icon: Trophy, label: 'Compete', iconClassName: 'text-playops-amber' },
] as const;

// Left panel of the login split-screen - marketing/brand side, laid over
// the stadium photo the page wrapper now renders behind both panels
// (app/login/page.tsx). Hidden below md; the photo itself still bleeds
// through on mobile via that page-level wrapper, only this panel's own
// content disappears.
export function LoginHeroPanel() {
  return (
    <aside className="relative hidden md:flex md:w-[58%] md:flex-col md:justify-between md:p-12 lg:p-16">
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Image
              src="/images/playops-logo-v4.png"
              alt="PlayOps"
              width={32}
              height={32}
              className="h-8 w-8 rounded"
            />
            <p className="text-lg font-extrabold tracking-tight text-white">PLAYOPS</p>
          </div>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-white/50">
            INTRAMURAL ATHLETICS
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Official Intra-Hostel League
        </div>
      </div>

      <div className="relative z-10 mt-44 lg:mt-56">
        <h1 className="text-4xl font-black uppercase leading-[1.05] tracking-tight lg:text-5xl">
          <span className="block text-white">One Campus.</span>
          <span className="block text-playops-amber">Countless Champions.</span>
        </h1>

        <p className="mt-4 max-w-sm text-sm text-white/60">
          From the first fixture to the final whistle, PlayOps brings every hostel onto one
          field. Build your team, reserve your ground, pick up your gear and play.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {TAGS.map(({ icon: Icon, label, iconClassName }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
            >
              <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />
              {label}
            </span>
          ))}
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
          System v1.5 online
        </div>
      </div>
    </aside>
  );
}
