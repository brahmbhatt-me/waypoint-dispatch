"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatPhone, normalizePhone } from "@/lib/utils";

type Step = "phone" | "form" | "success";

interface PreviousUser {
  id: string;
  name: string;
  defaultAddress?: string | null;
  addressHistory?: { address: string; usedAt: string }[];
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);

  // Phone lookup
  const [phone, setPhone] = useState("");
  const [existingUser, setExistingUser] = useState<PreviousUser | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [attending, setAttending] = useState(true);

  // Success data
  const [result, setResult] = useState<{ tripDate: string } | null>(null);

  async function handlePhoneLookup() {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/passengers?phone=${normalized}`);
      const user: PreviousUser | null = await res.json();

      if (user) {
        setExistingUser(user);
        setName(user.name);
        if (user.defaultAddress) setAddress(user.defaultAddress);
      }
      setStep("form");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (!address.trim() && attending) { toast.error("Please enter your dropoff address"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/passengers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          dropoffAddress: address.trim(),
          saveAsDefault,
          notes: notes.trim() || undefined,
          attending,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      setResult(data);
      setStep("success");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-bold text-gray-900">Register for This Saturday</h1>
            <p className="text-xs text-gray-500">BAPS Temple Trip · Ruggles Station</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* STEP 1: Phone number */}
        {step === "phone" && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-1">What&rsquo;s your phone number?</h2>
              <p className="text-sm text-gray-500 mb-4">
                We&rsquo;ll look up your info from previous trips so you don&rsquo;t have to re-enter it.
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

        {/* STEP 2: Registration form */}
        {step === "form" && (
          <div className="space-y-4">
            {existingUser && (
              <div className="card bg-green-50 border-green-100">
                <p className="text-sm text-green-700">
                  👋 Welcome back, <strong>{existingUser.name}</strong>!
                  We&rsquo;ve filled in your previous info. Just update anything that&rsquo;s changed.
                </p>
              </div>
            )}

            <div className="card space-y-4">
              {/* Attending toggle */}
              <div>
                <label className="label">Are you attending this Saturday?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAttending(true)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      attending
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    ✅ Yes, I&rsquo;m coming
                  </button>
                  <button
                    onClick={() => setAttending(false)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      !attending
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    ❌ Can&rsquo;t make it
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  placeholder="Priya Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>

              {/* Address — only if attending */}
              {attending && (
                <div>
                  <label className="label">Dropoff Address This Week *</label>
                  <input
                    type="text"
                    placeholder="45 Main St, Quincy, MA 02170"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter your full home or preferred dropoff address
                  </p>

                  {/* Previous address suggestions */}
                  {existingUser?.addressHistory && existingUser.addressHistory.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Recent addresses:</p>
                      {[...new Set(existingUser.addressHistory.map((a) => a.address))]
                        .slice(0, 3)
                        .map((addr) => (
                          <button
                            key={addr}
                            onClick={() => setAddress(addr)}
                            className="w-full text-left text-xs bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 rounded-lg px-3 py-2 text-gray-600 transition-colors truncate"
                          >
                            📍 {addr}
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Save as default */}
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="w-4 h-4 rounded accent-orange-500"
                    />
                    <span className="text-sm text-gray-600">
                      Save as my default address for future trips
                    </span>
                  </label>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., apartment #3, call when outside"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? "Registering..." : attending ? "✅ Register for Saturday" : "Submit (Not Attending)"}
            </button>

            <button onClick={() => setStep("phone")} className="btn-secondary">
              ← Back
            </button>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === "success" && result && (
          <div className="space-y-4">
            <div className="card text-center py-8">
              <div className="text-5xl mb-4">{attending ? "🎉" : "👋"}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {attending ? "You&rsquo;re registered!" : "Got it!"}
              </h2>
              <p className="text-gray-500 text-sm">
                {attending
                  ? `We'll send you your car assignment before the trip. Meet at Ruggles Station at the usual time.`
                  : `We've noted that you won't be attending this Saturday. See you next time!`}
              </p>
              {attending && (
                <div className="mt-4 bg-orange-50 rounded-xl p-4 text-left">
                  <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">
                    Pickup Location
                  </p>
                  <p className="text-sm font-semibold text-gray-900">Ruggles Station</p>
                  <p className="text-xs text-gray-500">Station concourse, south exit</p>
                </div>
              )}
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
