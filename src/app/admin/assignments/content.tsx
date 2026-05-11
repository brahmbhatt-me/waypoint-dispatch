"use client";

import { Suspense } from "react";
import AssignmentsContent from "./content";

export default function AssignmentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading assignments...</p>
      </div>
    }>
      <AssignmentsContent />
    </Suspense>
  );
}
