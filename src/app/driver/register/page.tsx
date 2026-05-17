"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { normalizePhone } from "@/lib/utils";
import { validateUSPhone } from "@/lib/maps";
import dynamic from "next/dynamic";

const AddressAutocomplete = dynamic(() => import("@/components/AddressAutocomplete"), { ssr: false });

type Step = "phone" | "form" | "success";

// Common car seat counts for reference
const CAR_PRESETS = [
  { label: "Sedan (4 seats)", passengers: 3 },
  { label: "SUV (5 seats)", passengers: 4 },
  { label: "Minivan (7 seats)", passengers: 6 },
  { label: "Large van (8 seats)", passengers: 7 },
];

export default function DriverRegisterPage() {
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [existingUser, setExistingUser] = useState<{ name: string } | null>(null);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(4);
  const [carType, setCarType] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [startLat, setStartLat] = useState<number | undefined>();
  const [startLng, setStartLng] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  async function handlePhoneLookup() {
    const normalized = normalizePhone(phone);
    if (!validateUSPhone(normalized)) {
      toast.error("Please enter a valid US phone number");
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

  const handleStartAddressChange = useCallback((addr: string, lat?: number, lng?: number) => {
    setStartAddress(addr); setStartLat(lat); setStartLng(lng);
  }, []);

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
          startAddress: startAddress.trim() || undefined,
          startLat, startLng,
          notes: notes.trim() || undefined,
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
            <h1 className="font-bold">Register as Driver</h1>
            <p className="text-xs text-gray-500">This Saturday&rsquo;s Temple Trip</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {step === "phone" && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold mb-1">Your phone number?</h2>
              <p className="text-sm text-gray-500 mb-4">US numbers only. Passengers will see this to contact you.</p>
              <label className="label">Phone Number</label>
              <input type="tel" inputMode="numeric" placeholder="(617) 555-0100"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
                className="input" autoFocus />
            </div>
            <button onClick={handlePhoneLookup} disabled={loading} className="btn-primary">
              {loading ? "Looking up..." : "Continue →"}
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            {existingUser && (
              <div className="card bg-blue-50 border-blue-100">
                <p className="text-sm text-blue-700">👋 Welcome back, <strong>{existingUser.name}</strong>! Thanks for driving again.</p>
              </div>
            )}

            <div className="card bg-orange-50 border-orange-100">
              <p className="text-sm text-orange-700">
                🚗 <strong>As a driver, you don&rsquo;t need to register as a passenger.</strong> You&rsquo;ll automatically be excluded from the passenger list.
              </p>
            </div>

            <div className="card space-y-4">
              <div>
                <label className="label">Your Name *</label>
                <input type="text" placeholder="Raj Patel" value={name} onChange={(e) => setName(e.target.value)} className="input" />
              </div>

              <div>
                <label className="label">How many passengers can you take? *</label>
                <div className="bg-blue-50 rounded-xl p-3 mb-3 text-xs text-blue-700">
                  💡 <strong>Enter passenger seats only — not counting yourself.</strong>
                  <br />Examples: 4-seat sedan = <strong>3</strong>, 7-seat minivan = <strong>6</strong>, 8-seat van = <strong>7</strong>
                </div>

                {/* Quick presets */}
                <button onClick={() => setShowPresets(!showPresets)} className="text-xs text-orange-500 hover:text-orange-600 mb-2 font-medium">
                  {showPresets ? "Hide" : "Quick pick by car type →"}
                </button>
                {showPresets && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {CAR_PRESETS.map((p) => (
                      <button key={p.label} onClick={() => { setSeats(p.passengers); setShowPresets(false); }}
                        className="text-left text-xs bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-lg px-3 py-2 transition-colors">
                        <p className="font-medium text-gray-700">{p.label}</p>
                        <p className="text-gray-500">→ enter <strong>{p.passengers}</strong></p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button onClick={() => setSeats(Math.max(1, seats - 1))} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-lg flex items-center justify-center">−</button>
                  <span className="text-3xl font-bold text-orange-500 w-8 text-center">{seats}</span>
                  <button onClick={() => setSeats(Math.min(10, seats + 1))} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-lg flex items-center justify-center">+</button>
                  <span className="text-sm text-gray-500">passengers</span>
                </div>
              </div>

              <div>
                <label className="label">Car Type <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" placeholder="e.g., Honda Odyssey (White)" value={carType} onChange={(e) => setCarType(e.target.value)} className="input" />
                <p className="text-xs text-gray-400 mt-1">Helps passengers find your car at Ruggles</p>
              </div>

              <div>
                <label className="label">Your starting location <span className="text-gray-400 font-normal">(optional)</span></label>
                <AddressAutocomplete value={startAddress} onChange={handleStartAddressChange} placeholder="Where are you driving from?" />
                <p className="text-xs text-gray-400 mt-1">Used to route pickups on the way to Ruggles</p>
              </div>

              <div>
                <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" placeholder="e.g., north side passengers only" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? "Registering..." : "🚗 Register as Driver"}
            </button>
            <button onClick={() => setStep("phone")} className="btn-secondary">← Back</button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="card text-center py-8">
              <div className="text-5xl mb-4">🚗</div>
              <h2 className="text-xl font-bold mb-2">You&rsquo;re registered as a driver!</h2>
              <p className="text-gray-500 text-sm">
                You&rsquo;ll get your passenger list and optimized route when assignments are released.
              </p>
              <div className="mt-4 bg-orange-50 rounded-xl p-3 text-left text-sm space-y-1">
                <p>🚉 Pick everyone up at <strong>Ruggles Station</strong></p>
                <p>🛕 Drive to <strong>BAPS Temple, Lowell</strong></p>
                <p>🗺️ After darshan, you&rsquo;ll get an optimized return route</p>
              </div>
            </div>
            <Link href="/"><button className="btn-primary">← Back to Home</button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
