"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTripDate } from "@/lib/utils";

interface TripHistory {
  id: string;
  date: string;
  status: string;
  passengerCount: number;
  driverCount: number;
  assignmentCount: number;
}

export default function HistoryPage() {
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trips/history")
      .then((r) => r.json())
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    OPEN: "badge-green",
    LOCKED: "badge-orange",
    COMPLETED: "badge-gray",
    GENERATING: "badge-orange",
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-bold">Trip History</h1>
            <p className="text-xs text-gray-500">All past and upcoming trips</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {loading && [1,2,3].map((i) => (
          <div key={i} className="card animate-pulse h-20" />
        ))}

        {!loading && trips.length === 0 && (
          <div className="card text-center py-12 text-gray-400">No trips yet</div>
        )}

        {trips.map((trip) => (
          <div key={trip.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{formatTripDate(trip.date)}</p>
                <div className="flex gap-3 mt-1 text-sm text-gray-500">
                  <span>👥 {trip.passengerCount} passengers</span>
                  <span>🚗 {trip.driverCount} drivers</span>
                  <span>📋 {trip.assignmentCount} cars assigned</span>
                </div>
              </div>
              <span className={`badge ${statusColor[trip.status] ?? "badge-gray"}`}>
                {trip.status}
              </span>
            </div>
            {trip.assignmentCount > 0 && (
              <Link href={`/admin/assignments?tripId=${trip.id}`}>
                <button className="mt-3 text-xs text-orange-500 hover:text-orange-600 font-medium">
                  View assignments →
                </button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
