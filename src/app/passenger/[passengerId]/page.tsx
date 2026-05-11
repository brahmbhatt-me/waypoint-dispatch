"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPhone } from "@/lib/utils";

interface PassengerAssignment {
  name: string;
  phone: string;
  dropoffAddress: string;
  assignedDriver: {
    name: string;
    phone: string;
    carType?: string | null;
    mapsUrl?: string | null;
  } | null;
  tripDate: string;
}

export default function PassengerViewPage() {
  const params = useParams();
  const userId = params.passengerId as string;
  const [data, setData] = useState<PassengerAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/passengers/view?userId=${userId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500">Loading your assignment...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card text-center max-w-sm">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="font-bold">Not found</h2>
          <p className="text-sm text-gray-500 mt-1">This link may be invalid or expired.</p>
          <Link href="/signup">
            <button className="btn-primary mt-4">Register for the Trip</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="bg-gradient-to-b from-orange-500 to-orange-600 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <p className="text-orange-100 text-sm">Saturday Temple Trip</p>
          <h1 className="text-2xl font-bold mt-1">Hi, {data.name}!</h1>
          <p className="text-orange-100 text-sm mt-1">Here&rsquo;s your car assignment for the return trip.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {data.assignedDriver ? (
          <>
            <div className="card border-2 border-orange-100">
              <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-xl">🚗</span> Your Assigned Car
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Driver</span>
                  <span className="font-semibold">{data.assignedDriver.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Car</span>
                  <span className="font-medium">{data.assignedDriver.carType || "TBD"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Phone</span>
                  <a href={`tel:${data.assignedDriver.phone}`} className="text-blue-500 font-medium">
                    {formatPhone(data.assignedDriver.phone)}
                  </a>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-gray-500 flex-shrink-0">Your Stop</span>
                  <span className="text-sm font-medium text-right">{data.dropoffAddress}</span>
                </div>
              </div>

              <a
                href={`tel:${data.assignedDriver.phone}`}
                className="mt-4 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Your Driver
              </a>
            </div>

            <div className="card bg-orange-50 border-orange-100">
              <h3 className="text-sm font-semibold text-orange-700 mb-2">📋 Reminder</h3>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p>🏢 Meet at <strong>Ruggles Station</strong> for the ride to the temple</p>
                <p>🛕 After darshan, find <strong>{data.assignedDriver.name}&rsquo;s {data.assignedDriver.carType || "car"}</strong></p>
                <p>🏠 You&rsquo;ll be dropped at <strong>{data.dropoffAddress}</strong></p>
              </div>
            </div>
          </>
        ) : (
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">⏳</div>
            <h2 className="font-semibold text-gray-900">Assignment Pending</h2>
            <p className="text-sm text-gray-500 mt-1">
              The organizer is still generating assignments. Check back closer to Saturday.
            </p>
          </div>
        )}

        <Link href="/">
          <button className="btn-secondary">← Back to Home</button>
        </Link>
      </div>
    </div>
  );
}
