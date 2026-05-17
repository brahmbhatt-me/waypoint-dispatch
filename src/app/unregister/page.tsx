"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { normalizePhone, formatTripDate } from "@/lib/utils";
import { validateUSPhone } from "@/lib/maps";

type Step = "phone" | "confirm" | "done";

interface MyRegistration {
  attendanceId: string;
  name: string;
  attending: boolean;
  dropoffAddress: string;
  tripDate: string;
  isLocked: boolean;
  driverSessionId?: string | null;
  isDriver: boolean;
}

export default function UnregisterPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [reg, setReg] = useState<MyRegistration | null>(null);

  async function handleLookup() {
    const normalized = normalizePhone(phone);
    if (!validateUSPhone(normalized)) {
      toast.error("Enter a valid US phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/unregister?phone=${normalized}`);
      const data = await res.json();
      if (!data) {
        toast.error("No registration found for this number");
        return;
      }
      setReg(data);
      setStep("confirm");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnregister() {
    if (!reg) return;
    if (reg.isLocked) {
      toast.error("Assignments are locked. Contact the organizer to make changes.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      setStep("done");
    } catch {
      toast.error("Something went wrong");
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
            <h1 className="font-bold">Cancel My Registration</h1>
            <p className="text-xs text-gray-500">Remove yourself from this Saturday</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {step === "phone" && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold mb-1">Enter your phone number</h2>
              <p className="text-sm text-gray-500 mb-4">
                We&rsquo;ll look up your registration so you can cancel it.
              </p>
              <label className="label">Phone Number</label>
              <input
                type="tel" inputMode="numeric" placeholder="(617) 555-0100"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="input" autoFocus
              />
            </div>
            <button onClick={handleLookup} disabled={loading} className="btn-primary">
              {loading ? "Looking up..." : "Find My Registration →"}
            </button>
            <Link href="/"><button className="btn-secondary">← Back to Home</button></Link>
          </div>
        )}

        {step === "confirm" && reg && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Your registration for {formatTripDate(reg.tripDate)}</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{reg.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${reg.attending ? "text-green-600" : "text-gray-400"}`}>
                    {reg.attending ? "Attending" : "Not attending"}
                  </span>
                </div>
                {reg.isDriver && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Role</span>
                    <span className="font-medium text-blue-600">Registered as Driver</span>
                  </div>
                )}
                {reg.dropoffAddress && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 flex-shrink-0">Dropoff</span>
                    <span className="font-medium text-right">{reg.dropoffAddress}</span>
                  </div>
                )}
              </div>

              {reg.isLocked && (
                <div className="mt-3 p-3 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-600 font-medium">🔒 Assignments are locked</p>
                  <p className="text-xs text-red-500 mt-0.5">Contact the organizer to make changes.</p>
                </div>
              )}
            </div>

            {!reg.isLocked && (
              <>
                <div className="card bg-yellow-50 border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This will remove you from this Saturday&rsquo;s trip.
                    {reg.isDriver ? " Your driver registration will also be cancelled." : ""}
                    {" "}You can re-register anytime before the trip.
                  </p>
                </div>
                <button onClick={handleUnregister} disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors">
                  {loading ? "Cancelling..." : "❌ Cancel My Registration"}
                </button>
              </>
            )}

            <button onClick={() => setStep("phone")} className="btn-secondary">← Back</button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="card text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold mb-2">Registration cancelled</h2>
              <p className="text-gray-500 text-sm">
                You&rsquo;ve been removed from this Saturday&rsquo;s trip. You can re-register anytime.
              </p>
            </div>
            <Link href="/signup"><button className="btn-primary">Re-register →</button></Link>
            <Link href="/"><button className="btn-secondary">← Back to Home</button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
