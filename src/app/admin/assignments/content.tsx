"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatPhone } from "@/lib/utils";

interface Assignment {
  id: string;
  tripId: string;
  isLocked: boolean;
  mapsUrl?: string | null;
  goingMapsUrl?: string | null;
  estimatedMinutes?: number | null;
  driver: {
    sessionId: string;
    userId: string;
    name: string;
    phone: string;
    carType?: string | null;
    seats: number;
  };
  passengers: {
    id: string;
    userId: string;
    name: string;
    phone: string;
    dropoffAddress: string;
    notes?: string | null;
  }[];
}

export default function AssignmentsContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/assignments?tripId=${tripId}`)
      .then((r) => r.json())
      .then(setAssignments)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [tripId]);

  function generateWhatsAppMessage(a: Assignment): string {
    const url = `${window.location.origin}/driver/${a.id}`;
    const stops = a.passengers.map((p, i) => `${i + 1}. ${p.name} — ${p.dropoffAddress}`).join("\n");
    const msg = `*BAPS Temple Trip — Saturday*\n\nHi ${a.driver.name}, you are driving!\n\n*Passengers (${a.passengers.length}/${a.driver.seats}):*\n${stops}\n\n*Your route:*\n${url}\n\nJay Swaminarayan`;
    return `https://wa.me/${a.driver.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  }

  function shareLink(a: Assignment) {
    const url = `${window.location.origin}/driver/${a.id}`;
    if (navigator.share) {
      navigator.share({ title: "Your Temple Trip Route", url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }

  const totalPassengers = assignments.reduce((s, a) => s + a.passengers.length, 0);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Link href="/admin" className="text-gray-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-bold">Loading...</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
          {[1,2,3].map((i) => <div key={i} className="card animate-pulse h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-bold text-gray-900">Car Assignments</h1>
              <p className="text-xs text-gray-500">{assignments.length} cars · {totalPassengers} passengers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {assignments.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-lg mb-2">No assignments yet</p>
            <Link href="/admin"><button className="btn-primary mt-4 max-w-xs mx-auto">← Generate Assignments</button></Link>
          </div>
        )}

        {assignments.map((a, idx) => (
          <div key={a.id} className="card border-2 border-gray-100">
            {/* Car header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚗</span>
                  <span className="font-bold">Car {idx + 1}</span>
                  <span className="badge badge-gray">{a.passengers.length}/{a.driver.seats} seats</span>
                  {a.isLocked && <span className="badge badge-green">Locked</span>}
                </div>
                <p className="text-sm font-medium text-gray-700 mt-1">{a.driver.name}</p>
                <p className="text-xs text-gray-500">
                  {a.driver.carType || "Car TBD"} ·{" "}
                  <a href={`tel:${a.driver.phone}`} className="text-blue-500">{formatPhone(a.driver.phone)}</a>
                </p>
                {a.estimatedMinutes && a.estimatedMinutes > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">~{a.estimatedMinutes} min return trip</p>
                )}
              </div>
            </div>

            {/* Passenger list */}
            <div className="space-y-2 mb-4">
              {a.passengers.map((p, stopIdx) => (
                <div key={p.id} className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {stopIdx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{p.name}</span>
                      <a href={`tel:${p.phone}`} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{p.dropoffAddress}</p>
                    {p.notes && <p className="text-xs text-blue-500">📝 {p.notes}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2">
                {a.mapsUrl && (
                  <a href={a.mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium py-2 px-3 rounded-lg">
                    🗺️ Return Route
                  </a>
                )}
                {a.goingMapsUrl && (
                  <a href={a.goingMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium py-2 px-3 rounded-lg">
                    🚉 Going Route
                  </a>
                )}
                {!a.mapsUrl && !a.goingMapsUrl && (
                  <div className="col-span-2 text-center text-xs text-gray-400 py-2">No route generated</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => shareLink(a)}
                  className="flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium py-2 px-3 rounded-lg">
                  🔗 Share Link
                </button>
                <a href={generateWhatsAppMessage(a)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1eb859] text-white text-sm font-medium py-2 px-3 rounded-lg">
                  WhatsApp
                </a>
              </div>

              <Link href={`/driver/${a.id}`} target="_blank">
                <button className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 border border-dashed border-gray-200 rounded-lg hover:border-gray-300">
                  Preview driver view ↗
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
