"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { normalizePhone } from "@/lib/utils";

type Step = "phone" | "form" | "success";

export default function DriverRegisterPage() {
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [existingUser, setExistingUser] = useState<{ name: string } | null>(null);

  const [name, setName] = useState("");
  const [seats, setSeats] = useState(4);
  const [carType, setCarType] = useState("");
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState<{ sessionId: string } | null>(null);

  async function handlePhoneLookup() {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/drivers?phone=${normalized}`);
      const user = await res.json();
      if (user) { setExistingUser(user); setName(user.name); }
      setStep("form");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (seats < 1) { toast.error("Please enter available seats"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          seats,
          carType: carType.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Registration failed"); return; }

      setResult(data);
      setStep("success");
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
            <h1 className="font-bold text-gray-900">Register as Driver</h1>
            <p className="text-xs text-gray-500">This Saturday&rsquo;s Temple Trip</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {step === "phone" && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-1">Your phone number?</h2>
              <p className="text-sm text-gray-500 mb-4">
                Passengers will see this to contact you.
              </p>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(617) 555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
                className="input"
                autoFocus
              />
            </div>
            <button
              onClick={handlePhoneLookup}
              disabled={loading || phone.replace(/\D/g, "").length < 10}
              className="btn-primary"
            >
              {loading ? "Looking up..." : "Continue →"}
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            {existingUser && (
              <div className="card bg-blue-50 border-blue-100">
                <p className="text-sm text-blue-700">
                  👋 Welcome back, <strong>{existingUser.name}</strong>! Thanks for driving again.
                </p>
              </div>
            )}

            <div className="card space-y-4">
              <div>
                <label className="label">Your Name *</label>
                <input
                  type="text"
                  placeholder="Raj Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Passenger Seats Available *</label>
                <p className="text-xs text-gray-400 mb-2">
                  How many passengers can you take? (not counting yourself)
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-lg flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-3xl font-bold text-orange-500 w-8 text-center">
                    {seats}
                  </span>
                  <button
                    onClick={() => setSeats(Math.min(10, seats + 1))}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-lg flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-500">passengers</span>
                </div>
              </div>

              <div>
                <label className="label">
                  Car Type <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Honda Odyssey (White)"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Helps passengers identify your car at Ruggles
                </p>
              </div>

              <div>
                <label className="label">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., I can only take South Boston passengers"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? "Registering..." : "🚗 Register as Driver"}
            </button>
            <button onClick={() => setStep("phone")} className="btn-secondary">
              ← Back
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="card text-center py-8">
              <div className="text-5xl mb-4">🚗</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You&rsquo;re registered as a driver!</h2>
              <p className="text-gray-500 text-sm">
                The organizer will send you your passenger list and Google Maps route before the trip.
              </p>
              <div className="mt-4 bg-blue-50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  What happens next
                </p>
                <p className="text-sm text-gray-700">
                  📍 Pick everyone up from <strong>Ruggles Station</strong>
                </p>
                <p className="text-sm text-gray-700">
                  🛕 Drive to <strong>BAPS Temple, Lowell</strong>
                </p>
                <p className="text-sm text-gray-700">
                  🗺️ After darshan, you&rsquo;ll get an optimized route to drop everyone home
                </p>
              </div>
            </div>
            <Link href="/">
              <button className="btn-primary">← Back to Home</button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
