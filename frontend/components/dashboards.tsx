import { MeResponse } from '@/lib/api';

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
  return (
    <div>
      <h2 className="text-xl font-semibold">Caretaker dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        You&apos;re the Caretaker for: {me.caretakerOfHostels.map((h) => h.name).join(', ')}.
        Hostel-change approvals and Secretary appointment go here in Phase 9.
      </p>
    </div>
  );
}

export function SecretaryDashboard({ me }: { me: MeResponse }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Sports Secretary dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        You&apos;re the Secretary for: {me.secretaryOfHostels.map((h) => h.name).join(', ')}.
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
