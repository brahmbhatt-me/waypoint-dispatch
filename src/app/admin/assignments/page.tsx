"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
const AssignmentsContent = dynamic(() => import("./content"), { ssr: false });
export default function AssignmentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <AssignmentsContent />
    </Suspense>
  );
}
