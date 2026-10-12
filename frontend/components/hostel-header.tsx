import { HostelRef } from '@/lib/api';

export function HostelHeader({ hostel, subtitle }: { hostel: HostelRef; subtitle: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
        {hostel.code}
      </span>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{hostel.name}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
