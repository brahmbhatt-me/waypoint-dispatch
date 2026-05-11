"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPhone } from "@/lib/utils";

interface AssignmentDetail {
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
    name: string;
    phone: string;
    dropoffAddress: string;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
    notes?: string | null;
  }[];
}

export default function DriverViewPage() {
  const params = useParams();
  const assignmentId = params.driverId as string;
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/assignments/${assignmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAssignment(data);
      })
      .catch(() => setError("Failed to load assignment"))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🚗</div>
          <p className="text-gray-500">Loading your route...</p>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card text-center max-w-sm">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="font-bold text-gray-900 mb-2">Assignment not found</h2>
          <p className="text-sm text-gray-500">{error || "This link may have expired."}</p>
          <Link href="/">
            <button className="btn-primary mt-4">Back to Home</button>
          </Link>
        </div>
      </div>
    );
  }

  const totalStops = assignment.passengers.length;

  return (
    <div className="page-container">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-700 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <p className="text-blue-200 text-sm font-medium">Your Route — Saturday Temple Trip</p>
          <h1 className="text-2xl font-bold mt-1">Hi, {assignment.driver.name}!</h1>
          <p className="text-blue-100 text-sm mt-1">
            {assignment.driver.carType || "Your car"} · {totalStops} passenger{totalStops !== 1 ? "s" : ""}
          </p>

          {/* Quick stats */}
          <div className="flex gap-4 mt-4">
            <div className="bg-white/20 rounded-xl px-4 py-2">
              <p className="text-xs text-blue-100">Passengers</p>
              <p className="font-bold text-xl">{totalStops}</p>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2">
              <p className="text-xs text-blue-100">Stops</p>
              <p className="font-bold text-xl">{totalStops}</p>
            </div>
            {assignment.estimatedMinutes && (
              <div className="bg-white/20 rounded-xl px-4 py-2">
                <p className="text-xs text-blue-100">Est. Time</p>
                <p className="font-bold text-xl">~{assignment.estimatedMinutes}m</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Navigation button — BIG and prominent */}
        {assignment.mapsUrl ? (
          <a
            href={assignment.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-2xl p-5 flex items-center gap-4 transition-colors shadow-lg shadow-green-200">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-lg">Open Navigation</p>
                <p className="text-green-100 text-sm">Optimized route for all {totalStops} stops</p>
              </div>
              <svg className="w-6 h-6 text-white/70 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
          </a>
        ) : (
          <div className="card text-center py-4 border-dashed">
            <p className="text-gray-400 text-sm">Navigation link not yet available</p>
          </div>
        )}

        {/* Route summary */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📍</span> Your Dropoff Route
          </h2>

          {/* Origin: Temple */}
          <div className="flex items-start gap-3 pb-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">
                🛕
              </div>
              <div className="w-0.5 h-full bg-gray-200 mt-1" style={{ minHeight: "20px" }} />
            </div>
            <div className="pb-3">
              <p className="font-medium text-sm">BAPS Temple, Lowell</p>
              <p className="text-xs text-gray-500">84 Industrial Ave E, Lowell, MA 01852</p>
              <p className="text-xs text-orange-500 mt-0.5">↑ Starting point (return trip)</p>
            </div>
          </div>

          {/* Stops */}
          {assignment.passengers.map((p, idx) => (
            <div key={p.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  idx === assignment.passengers.length - 1
                    ? "bg-blue-500 text-white"
                    : "bg-blue-100 text-blue-600"
                }`}>
                  {idx + 1}
                </div>
                {idx < assignment.passengers.length - 1 && (
                  <div className="w-0.5 bg-gray-200 mt-1" style={{ minHeight: "20px" }} />
                )}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-gray-900">{p.name}</p>
                  <a
                    href={`tel:${p.phone}`}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {formatPhone(p.phone)}
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.dropoffAddress}</p>
                {p.notes && (
                  <p className="text-xs text-blue-500 mt-0.5 bg-blue-50 rounded px-2 py-0.5 inline-block">
                    📝 {p.notes}
                  </p>
                )}
                {/* Individual directions link */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.dropoffAddress)}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:text-green-700 mt-1 inline-block"
                >
                  📍 Directions to this stop ↗
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Quick contact all */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm">📞 Quick Contacts</h2>
          <div className="space-y-2">
            {assignment.passengers.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{p.name}</span>
                <a
                  href={`tel:${p.phone}`}
                  className="text-sm font-medium text-blue-500 hover:text-blue-700"
                >
                  {formatPhone(p.phone)}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Trip info */}
        <div className="card bg-orange-50 border-orange-100">
          <h3 className="text-sm font-semibold text-orange-700 mb-2">📋 Trip Info</h3>
          <div className="space-y-1.5 text-sm text-gray-600">
            <p>🏢 <strong>Pickup:</strong> Ruggles Station, Boston</p>
            <p>🛕 <strong>Destination:</strong> BAPS Temple, Lowell</p>
            <p>↩️ <strong>Return:</strong> Drop passengers at their addresses above</p>
          </div>
        </div>

        <div className="text-center pb-6">
          <p className="text-xs text-gray-400">Jay Swaminarayan 🙏</p>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-500 block mt-1">
            ← Temple Transport Home
          </Link>
        </div>
      </div>
    </div>
  );
}
