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

const DRIVER_BASE_URL = typeof window !== "undefined"
  ? `${window.location.origin}/driver`
  : "";

export default function AssignmentsPage() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/assignments?tripId=${tripId}`)
      .then((r) => r.json())
      .then(setAssignments)
      .catch(() => toast.error("Failed to load assignments"))
      .finally(() => setLoading(false));
  }, [tripId]);

  async function copyDriverLink(assignmentId: string) {
    const url = `${window.location.origin}/driver/${assignmentId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(assignmentId);
    toast.success("Driver link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function shareDriverLink(assignment: Assignment) {
    const url = `${window.location.origin}/driver/${assignment.id}`;
    const text = `Hi ${assignment.driver.name}! Here is your passenger list and route for Saturday's temple trip:\n\n${url}`;
    if (navigator.share) {
      navigator.share({ title: "Your Temple Trip Route", text, url });
    } else {
      // Fallback: copy
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }

  function generateWhatsAppMessage(assignment: Assignment): string {
    const url = `${window.location.origin}/driver/${assignment.id}`;
    const stopList = assignment.passengers
      .map((p, i) => `${i + 1}. ${p.name} — ${p.dropoffAddress}`)
      .join("\n");
    const message = `🛕 *BAPS Temple Trip — Saturday*\n\nHi ${assignment.driver.name}, you're driving!\n\n*Your Passengers (${assignment.passengers.length}/${assignment.driver.seats}):*\n${stopList}\n\n*Your optimized route:*\n${url}\n\nJay Swaminarayan 🙏`;
    return `https://wa.me/${assignment.driver.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
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
            <h1 className="font-bold">Loading Assignments...</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-40" />
          ))}
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
              <p className="text-xs text-gray-500">
                {assignments.length} cars · {totalPassengers} passengers
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {assignments.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-lg mb-2">No assignments yet</p>
            <p className="text-sm text-gray-400">Go to Admin and click "Generate Assignments"</p>
            <Link href="/admin">
              <button className="btn-primary mt-4 max-w-xs mx-auto">← Back to Admin</button>
            </Link>
          </div>
        )}

        {assignments.map((assignment, idx) => (
          <div key={assignment.id} className="card border-2 border-gray-100 overflow-hidden">
            {/* Car header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚗</span>
                  <span className="font-bold text-gray-900">Car {idx + 1}</span>
                  <span className="badge badge-gray">
                    {assignment.passengers.length}/{assignment.driver.seats} seats
                  </span>
                  {assignment.isLocked && <span className="badge badge-green">🔒 Locked</span>}
                </div>
                <p className="text-sm font-medium text-gray-700 mt-1">
                  {assignment.driver.name}
                </p>
                <p className="text-xs text-gray-500">
                  {assignment.driver.carType || "Car not specified"} ·{" "}
                  <a href={`tel:${assignment.driver.phone}`} className="text-blue-500">
                    {formatPhone(assignment.driver.phone)}
                  </a>
                </p>
              </div>
            </div>

            {/* Passenger list */}
            <div className="space-y-2 mb-4">
              {assignment.passengers.map((p, stopIdx) => (
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
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
              {/* Google Maps */}
              {assignment.mapsUrl ? (
                <a
                  href={assignment.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Maps Route
                </a>
              ) : (
                <button disabled className="flex items-center justify-center gap-1.5 bg-gray-50 text-gray-400 text-sm font-medium py-2 px-3 rounded-lg opacity-50 cursor-not-allowed">
                  No Route
                </button>
              )}

              {/* Share driver link */}
              <button
                onClick={() => shareDriverLink(assignment)}
                className="flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Link
              </button>
            </div>

            {/* WhatsApp button */}
            <a
              href={generateWhatsAppMessage(assignment)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1eb859] text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors w-full"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Send via WhatsApp
            </a>

            {/* Driver view link */}
            <div className="mt-2">
              <Link href={`/driver/${assignment.id}`} target="_blank">
                <button className="w-full text-xs text-gray-400 hover:text-gray-600 py-1.5 text-center border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
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
