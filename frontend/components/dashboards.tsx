import { MeResponse, HostelRef } from '@/lib/api';

function HostelHeader({ hostel, subtitle }: { hostel: HostelRef; subtitle: string }) {
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

export function StudentDashboard({ me }: { me: MeResponse }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Student dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        Welcome, {me.name}. Tournaments, fixtures, and results will appear here starting
        Phase 9.
      </p>
    </div>
  );
}

export function CaretakerDashboard({ me }: { me: MeResponse }) {
  // A Caretaker is unique to at most one hostel (Hostel.caretakerUserId is
  // a unique column - see database-design.md), so this array only ever
  // has zero or one entries in practice.
  const hostel = me.caretakerOfHostels[0];

  if (!hostel) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Caretaker dashboard</h2>
        <p className="mt-2 text-muted-foreground">No hostel assignment found.</p>
      </div>
    );
  }

  return (
    <div>
      <HostelHeader hostel={hostel} subtitle="Caretaker Dashboard" />
      <p className="text-muted-foreground">
        Hostel-change approvals and Secretary appointment go here in Phase 9.
      </p>
    </div>
  );
}

export function SecretaryDashboard({ me }: { me: MeResponse }) {
  const hostel = me.secretaryOfHostels[0];

  if (!hostel) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Sports Secretary dashboard</h2>
        <p className="mt-2 text-muted-foreground">No hostel assignment found.</p>
      </div>
    );
  }

  return (
    <div>
      <HostelHeader hostel={hostel} subtitle="Sports Secretary Dashboard" />
      <p className="text-muted-foreground">
        Tournament creation and management go here in Phase 9.
      </p>
    </div>
  );
}

export function SportsAdminDashboard({ me }: { me: MeResponse }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Sports Department dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        Welcome, {me.name}. Venue and equipment booking approvals go here in Phase 9.
      </p>
    </div>
  );
}
