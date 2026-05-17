"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTripDate } from "@/lib/utils";

interface TripInfo {
  id: string;
  date: string;
  status: string;
  passengerCount: number;
  driverCount: number;
  totalSeats: number;
}

export default function HomePage() {
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then((data) => setTrip(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    OPEN: "bg-green-100 text-green-700",
    GENERATING: "bg-yellow-100 text-yellow-700",
    LOCKED: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-gray-100 text-gray-600",
  };

  const statusLabel: Record<string, string> = {
    OPEN: "Open — Signups Welcome",
    GENERATING: "Generating Assignments...",
    LOCKED: "Assignments Ready",
    COMPLETED: "Trip Completed",
  };

  return (
    <div className="page-container">
      <div className="bg-gradient-to-b from-orange-500 to-orange-600 text-white px-4 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="text-4xl mb-3">🛕</div>
          <h1 className="text-2xl font-bold">BAPS Temple Transport</h1>
          <p className="text-orange-100 mt-1 text-sm">
            Ruggles Station → BAPS Swaminarayan Mandir, Lowell
          </p>

          {!loading && trip && (
            <div className="mt-5 bg-white/20 backdrop-blur rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-100 font-medium uppercase tracking-wide">This Saturday</p>
                  <p className="font-semibold mt-0.5">{formatTripDate(trip.date)}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[trip.status] ?? "bg-white/20 text-white"}`}>
                  {statusLabel[trip.status] ?? trip.status}
                </span>
              </div>
              <div className="flex gap-4 mt-3 text-sm">
                <div><span className="font-semibold">{trip.passengerCount}</span><span className="text-orange-100 ml-1">passengers</span></div>
                <div><span className="font-semibold">{trip.driverCount}</span><span className="text-orange-100 ml-1">drivers</span></div>
                <div><span className="font-semibold">{trip.totalSeats}</span><span className="text-orange-100 ml-1">seats</span></div>
              </div>
            </div>
          )}
          {loading && (
            <div className="mt-5 bg-white/10 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-white/20 rounded w-40 mb-2" />
              <div className="h-4 bg-white/20 rounded w-24" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        <Link href="/signup">
          <div className="card flex items-center gap-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-all">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🙋</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">I&rsquo;m Attending</p>
              <p className="text-sm text-gray-500 mt-0.5">Register your name &amp; dropoff address</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/driver/register">
          <div className="card flex items-center gap-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-all">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🚗</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">I&rsquo;m Driving</p>
              <p className="text-sm text-gray-500 mt-0.5">Register your car &amp; available seats</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/my-assignment">
          <div className="card flex items-center gap-4 cursor-pointer hover:shadow-md transition-all border-2 border-orange-200">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📋</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-orange-600">My Car Assignment</p>
              <p className="text-sm text-gray-500 mt-0.5">Look up your assigned driver &amp; route</p>
            </div>
            <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center">
            <span className="bg-gray-50 px-3 text-xs text-gray-400 uppercase tracking-wider">Organizers</span>
          </div>
        </div>

        <Link href="/admin">
          <div className="card flex items-center gap-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-all">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">⚙️</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">Admin Dashboard</p>
              <p className="text-sm text-gray-500 mt-0.5">Manage passengers, generate assignments, view history</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <p className="text-center text-xs text-gray-400 pt-4">BAPS Boston Campus Connect · Made with 🙏</p>
      </div>
    </div>
  );
}
