'use client';

import { useStudentGuard } from '@/components/student/use-student-guard';
import { StudentNavbar } from '@/components/student/student-navbar';
import { StudentEquipmentPage } from '@/components/student/student-equipment-page';
import { HostelSelector } from '@/components/hostel-selector';

export default function StudentEquipmentRoute() {
  const me = useStudentGuard();

  if (!me) {
    return <p className="min-h-screen bg-playops-dark-bg p-6 text-white/60">Loading…</p>;
  }

  if (!me.hostel) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <HostelSelector />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-playops-dark-bg text-white">
      <StudentNavbar me={me} hostel={me.hostel} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <StudentEquipmentPage />
      </main>
    </div>
  );
}
