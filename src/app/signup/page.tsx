"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { normalizePhone } from "@/lib/utils";
import { validateUSPhone } from "@/lib/maps";
import dynamic from "next/dynamic";

const AddressAutocomplete = dynamic(() => import("@/components/AddressAutocomplete"), { ssr: false });

type Step = "phone" | "form" | "success";

interface TripInfo {
  id: string;
  status: string;
  goingLocked: boolean;
  goingCutoff?: string;
}

interface PreviousUser {
  id: string;
  name: string;
  defaultAddress?: string | null;
  addressHistory?: { address: string }[];
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [phone, setPhone] = useState("");
  const [existingUser, setExistingUser] = useState<PreviousUser | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressLat, setAddressLat] = useState<number | undefined>();
  const [addressLng, setAddressLng] = useState<number | undefined>();
  const [pickupPreference, setPickupPreference] = useState<"RUGGLES" | "DRIVER">("RUGGLES");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | undefined>();
  const [pickupLng, setPickupLng] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [attending, setAttending] = useState(true);

  useEffect(() => {
    fetch("/api/trips").then((r) => r.json()).then(setTrip).catch(console.error);
  }, []);

  const goingLocked = trip?.goingLocked ?? false;
  const returnLocked = trip?.status === "LOCKED" || trip?.status === "COMPLETED";

  async function handlePhoneLookup() {
    const normalized = normalizePhone(phone);
    if (!validateUSPhone(normalized)) {
      toast.error("Please enter a valid US phone number");
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
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const handleAddressChange = useCallback((addr: string, lat?: number, lng?: number) => {
    setAddress(addr); setAddressLat(lat); setAddressLng(lng);
  }, []);

  const handlePickupAddressChange = useCallback((addr: string, lat?: number, lng?: number) => {
    setPickupAddress(addr); setPickupLat(lat); setPickupLng(lng);
  }, []);

  async function handleSubmit() {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (attending && !address.trim()) { toast.error("Please enter your dropoff address"); return; }
    if (attending && !goingLocked && pickupPreference === "DRIVER" && !pickupAddress.trim()) {
      toast.error("Please enter your pickup address"); return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/passengers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          dropoffAddress: address.trim(),
          dropoffLat: addressLat,
          dropoffLng: addressLng,
          pickupPreference: goingLocked ? "RUGGLES" : pickupPreference,
          pickupAddress: !goingLocked && pickupPreference === "DRIVER" ? pickupAddress : undefined,
          pickupLat: !goingLocked && pickupPreference === "DRIVER" ? pickupLat : undefined,
          pickupLng: !goingLocked && pickupPreference === "DRIVER" ? pickupLng : undefined,
          returnOnly: goingLocked,
          saveAsDefault,
          notes: notes.trim() || undefined,
          attending,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Registration failed"); return; }
      setStep("success");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (returnLocked) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <Link href="/" className="text-gray-400 p-1 -ml-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-bold">Register for This Saturday</h1>
          </div>
        </div>
        <div className="page-content">
          <div className="card text-center py-10">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="font-bold text-gray-900 mb-2">Assignments are locked</h2>
            <p className="text-sm text-gray-500">
              The organizer has finalized car assignments. Check your assignment below.
            </p>
            <Link href="/my-assignment">
              <button className="btn-primary mt-4">📋 View My Assignment</button>
            </Link>
          </div>
        </div>
      </div>
    );
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
            <h1 className="font-bold text-gray-900">Register for This Saturday</h1>
            <p className="text-xs text-gray-500">BAPS Temple Trip</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Going trip locked banner */}
        {goingLocked && (
          <div className="card bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-800 font-medium">⏰ Going trip registration is closed</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              You can still register for the <strong>return trip</strong> — just enter your dropoff address below.
            </p>
          </div>
        )}

        {step === "phone" && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold mb-1">What&rsquo;s your phone number?</h2>
              <p className="text-sm text-gray-500 mb-4">US numbers only. We&rsquo;ll remember you for future trips.</p>
              <label className="label">Phone Number</label>
              <input
                type="tel" inputMode="numeric" placeholder="(617) 555-0100"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
                className="input" autoFocus
              />
            </div>
            <button onClick={handlePhoneLookup} disabled={loading} className="btn-primary">
              {loading ? "Looking up..." : "Continue →"}
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            {existingUser && (
              <div className="card bg-green-50 border-green-100">
                <p className="text-sm text-green-700">
                  👋 Welcome back, <strong>{existingUser.name}</strong>! Update anything that&rsquo;s changed.
                </p>
              </div>
            )}

            <div className="card space-y-4">
              <div>
                <label className="label">Attending this Saturday?</label>
                <div className="flex gap-3">
                  <button onClick={() => setAttending(true)} className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${attending ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                    ✅ Yes, I&rsquo;m coming
                  </button>
                  <button onClick={() => setAttending(false)} className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${!attending ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                    ❌ Can&rsquo;t make it
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Full Name *</label>
                <input type="text" placeholder="Priya Patel" value={name} onChange={(e) => setName(e.target.value)} className="input" />
              </div>

              {attending && (
                <>
                  {/* Only show pickup preference if going trip not locked */}
                  {!goingLocked && (
                    <div>
                      <label className="label">How are you getting to Ruggles?</label>
                      <div className="flex gap-3">
                        <button onClick={() => setPickupPreference("RUGGLES")} className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${pickupPreference === "RUGGLES" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                          🚉 Meet at Ruggles
                        </button>
                        <button onClick={() => setPickupPreference("DRIVER")} className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${pickupPreference === "DRIVER" ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                          🚗 Driver picks me up
                        </button>
                      </div>
                    </div>
                  )}

                  {!goingLocked && pickupPreference === "DRIVER" && (
                    <div>
                      <label className="label">Your pickup address *</label>
                      <AddressAutocomplete value={pickupAddress} onChange={handlePickupAddressChange} placeholder="Where should the driver pick you up?" />
                    </div>
                  )}

                  <div>
                    <label className="label">
                      {goingLocked ? "Your dropoff address for return trip *" : "Return dropoff address *"}
                    </label>
                    <AddressAutocomplete value={address} onChange={handleAddressChange} placeholder="Where should you be dropped off?" />
                    {existingUser?.addressHistory && existingUser.addressHistory.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500 font-medium">Recent addresses:</p>
                        {[...new Set(existingUser.addressHistory.map((a) => a.address))].slice(0, 3).map((addr) => (
                          <button key={addr} onClick={() => setAddress(addr)} className="w-full text-left text-xs bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 rounded-lg px-3 py-2 text-gray-600 truncate">
                            📍 {addr}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} className="w-4 h-4 rounded accent-orange-500" />
                      <span className="text-sm text-gray-600">Save as my default address</span>
                    </label>
                  </div>

                  <div>
                    <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" placeholder="e.g., apt #3, call when outside" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
                  </div>
                </>
              )}
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? "Registering..." : attending ? "✅ Register for Saturday" : "Submit"}
            </button>
            <button onClick={() => setStep("phone")} className="btn-secondary">← Back</button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="card text-center py-8">
              <div className="text-5xl mb-4">{attending ? "🎉" : "👋"}</div>
              <h2 className="text-xl font-bold mb-2">{attending ? "You're registered!" : "Got it!"}</h2>
              <p className="text-gray-500 text-sm">
                {attending
                  ? goingLocked
                    ? "You're registered for the return trip. Check your assignment once the organizer finalizes it."
                    : pickupPreference === "DRIVER"
                      ? "Your driver will pick you up before heading to Ruggles!"
                      : "Meet at Ruggles Station. You'll get your car assignment before the return trip."
                  : "See you next week!"}
              </p>
              {attending && (
                <Link href="/my-assignment">
                  <button className="btn-secondary mt-4">📋 Check My Assignment</button>
                </Link>
              )}
            </div>
            <Link href="/"><button className="btn-primary">← Back to Home</button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
