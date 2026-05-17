"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { normalizePhone, formatPhone } from "@/lib/utils";

interface AssignmentLookup {
  name: string;
  attending: boolean;
  dropoffAddress: string;
  pickupPreference: string;
  pickupAddress?: string;
  tripDate: string;
  assignedDriver: {
    name: string;
    phone: string;
    carType?: string | null;
    mapsUrl?: string | null;
    seats: number;
  } | null;
  stopNumber?: number;
  totalStops?: number;
}

export default function MyAssignmentPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssignmentLookup | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleLookup() {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/my-assignment?phone=${normalized}`);
      const data = await res.json();
      setResult(data);
      setSearched(true);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-bold">My Assignment</h1>
            <p className="text-xs text-gray-500">Look up your car for this Saturday</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="card space-y-3">
          <label className="label">Your Phone Number</label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="(617) 555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="input"
            autoFocus
          />
          <button onClick={handleLookup} disabled={loading} className="btn-primary">
            {loading ? "Looking up..." : "🔍 Find My Assignment"}
          </button>
        </div>

        {searched && !result && (
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">😕</div>
            <p className="font-semibold text-gray-900">Not found</p>
            <p className="text-sm text-gray-500 mt-1">
              This number isn&rsquo;t registered for this Saturday.
            </p>
            <Link href="/signup">
              <button className="btn-primary mt-4">Register Now</button>
            </Link>
          </div>
        )}

        {result && !result.attending && (
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">🏠</div>
            <p className="font-semibold">You&rsquo;re marked as not attending this Saturday</p>
            <Link href="/signup">
              <button className="btn-primary mt-4">Update My Registration</button>
            </Link>
          </div>
        )}

        {result && result.attending && (
          <>
            {!result.assignedDriver ? (
              <div className="card text-center py-8">
                <div className="text-4xl mb-3">⏳</div>
                <h2 className="font-semibold">Hi {result.name}!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Assignments haven&rsquo;t been generated yet. Check back closer to the trip.
                </p>
              </div>
            ) : (
              <>
                <div className="card border-2 border-orange-100">
                  <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span>🚗</span> Hi {result.name}, here&rsquo;s your car!
                  </h2>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Driver</span>
                      <span className="font-semibold">{result.assignedDriver.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Car</span>
                      <span className="font-medium">{result.assignedDriver.carType || "TBD"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Driver Phone</span>
                      <a href={`tel:${result.assignedDriver.phone}`} className="text-blue-500 font-medium">
                        {formatPhone(result.assignedDriver.phone)}
                      </a>
                    </div>
                    {result.stopNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Your stop</span>
                        <span className="font-medium">#{result.stopNumber} of {result.totalStops}</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 pt-1 border-t border-gray-100">
                      <span className="text-sm text-gray-500 flex-shrink-0">Dropoff</span>
                      <span className="text-sm font-medium text-right">{result.dropoffAddress}</span>
                    </div>
                    {result.pickupPreference === "DRIVER" && result.pickupAddress && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-gray-500 flex-shrink-0">Pickup</span>
                        <span className="text-sm font-medium text-right text-purple-600">{result.pickupAddress}</span>
                      </div>
                    )}
                  </div>

                  <a href={`tel:${result.assignedDriver.phone}`} className="mt-4 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors w-full">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call Your Driver
                  </a>
                </div>

                <div className="card bg-orange-50 border-orange-100">
                  <h3 className="text-sm font-semibold text-orange-700 mb-2">📋 Reminder</h3>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    {result.pickupPreference === "DRIVER" ? (
                      <p>🚗 <strong>{result.assignedDriver.name}</strong> will pick you up at <strong>{result.pickupAddress}</strong></p>
                    ) : (
                      <p>🚉 Meet at <strong>Ruggles Station</strong> for the ride to the temple</p>
                    )}
                    <p>🛕 After darshan, find <strong>{result.assignedDriver.name}&rsquo;s car</strong></p>
                    <p>🏠 You&rsquo;ll be dropped at <strong>{result.dropoffAddress}</strong></p>
                  </div>
                </div>
              </>
            )}

            <Link href="/signup">
              <button className="btn-secondary">Update My Registration</button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
