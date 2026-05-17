"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatTripDate, normalizePhone } from "@/lib/utils";
import { validateUSPhone } from "@/lib/maps";
import dynamic from "next/dynamic";

const AddressAutocomplete = dynamic(() => import("@/components/AddressAutocomplete"), { ssr: false });

interface Trip {
  id: string;
  date: string;
  status: string;
  goingLocked: boolean;
  passengerCount: number;
  driverCount: number;
  totalSeats: number;
  assignmentSummary?: string | null;
}

interface Passenger {
  id: string;
  userId: string;
  name: string;
  phone: string;
  dropoffAddress: string;
  notes?: string;
  attending: boolean;
  markedAbsent?: boolean;
  isWalkIn?: boolean;
  returnOnly?: boolean;
  assignmentId?: string | null;
}

interface Driver {
  id: string;
  userId: string;
  name: string;
  phone: string;
  carType?: string;
  seats: number;
  available: boolean;
  passengerCount: number;
}

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || "baps2024";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"passengers" | "drivers">("passengers");
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInAddress, setWalkInAddress] = useState("");
  const [walkInLat, setWalkInLat] = useState<number | undefined>();
  const [walkInLng, setWalkInLng] = useState<number | undefined>();
  const [walkInLoading, setWalkInLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const tripRes = await fetch("/api/trips");
      const tripData = await tripRes.json();
      setTrip(tripData);
      const [pRes, dRes] = await Promise.all([
        fetch(`/api/passengers?tripId=${tripData.id}`),
        fetch(`/api/drivers?tripId=${tripData.id}`),
      ]);
      setPassengers(await pRes.json());
      setDrivers(await dRes.json());
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authed) loadData(); }, [authed, loadData]);
  useEffect(() => { const expiry = sessionStorage.getItem("admin_auth");
if (expiry && Date.now() < Number(expiry)) setAuthed(true);
else sessionStorage.removeItem("admin_auth"); }, []);

  function handleAuth() {
    if (passcode === ADMIN_CODE) {
      setAuthed(true);
      const expiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
sessionStorage.setItem("admin_auth", String(expiry));
    } else {
      toast.error("Incorrect passcode");
    }
  }

  async function handleGenerateAssignments() {
    if (!trip) return;
    if (!confirm(`Generate assignments for ${attendingCount} passengers across ${availableDriverCount} cars? This will overwrite existing assignments.`)) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/assignments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, adminCode: ADMIN_CODE }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Generation failed"); return; }
      toast.success(`✅ Assigned ${data.totalPassengersAssigned} passengers to ${data.assignmentsCreated} cars!`);
      await loadData();
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleLockGoing() {
    if (!trip) return;
    if (!confirm("Lock the going trip? Passengers can no longer add pickup preferences. They can still register for the return trip.")) return;
    try {
      await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, action: "lock_going" }),
      });
      toast.success("🔒 Going trip locked!");
      await loadData();
    } catch {
      toast.error("Failed");
    }
  }

  async function handleLockReturn() {
    if (!trip) return;
    if (!confirm("Lock return assignments and release them to passengers? Everyone can now see their car on /my-assignment.")) return;
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, action: "lock_return" }),
      });
      const data = await res.json();
      if (data.assignmentSummary) {
        setTrip((prev) => prev ? { ...prev, status: "LOCKED", assignmentSummary: data.assignmentSummary } : prev);
        setShowSharePanel(true);
      }
      toast.success("🔒 Assignments released to passengers!");
      await loadData();
    } catch {
      toast.error("Failed");
    }
  }

  async function handleUnlock() {
    if (!trip) return;
    if (!confirm("Unlock trip? Passengers will no longer see their assignments until you re-lock.")) return;
    try {
      await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, action: "unlock" }),
      });
      toast.success("🔓 Trip unlocked");
      await loadData();
    } catch {
      toast.error("Failed");
    }
  }

  async function handleMarkAbsent(attendanceId: string, absent: boolean) {
    try {
      await fetch("/api/passengers/absent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, absent, adminCode: ADMIN_CODE }),
      });
      toast.success(absent ? "Marked absent" : "Marked present");
      await loadData();
    } catch { toast.error("Failed"); }
  }

  async function handleDeletePassenger(attendanceId: string, name: string) {
    if (!confirm(`Remove ${name} from this trip?`)) return;
    try {
      await fetch("/api/passengers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, adminCode: ADMIN_CODE }),
      });
      toast.success(`${name} removed`);
      await loadData();
    } catch { toast.error("Failed"); }
  }

  async function handleDeleteDriver(sessionId: string, name: string) {
    if (!confirm(`Remove ${name} as driver?`)) return;
    try {
      await fetch("/api/drivers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, adminCode: ADMIN_CODE }),
      });
      toast.success(`${name} removed`);
      await loadData();
    } catch { toast.error("Failed"); }
  }

  async function handleAddWalkIn() {
    if (!walkInName.trim()) { toast.error("Enter name"); return; }
    if (!validateUSPhone(normalizePhone(walkInPhone))) { toast.error("Enter valid US phone"); return; }
    if (!walkInAddress.trim()) { toast.error("Enter address"); return; }
    setWalkInLoading(true);
    try {
      const res = await fetch("/api/passengers/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: walkInName.trim(),
          phone: normalizePhone(walkInPhone),
          dropoffAddress: walkInAddress,
          dropoffLat: walkInLat,
          dropoffLng: walkInLng,
          adminCode: ADMIN_CODE,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success(data.autoAssigned ? `${walkInName} added & auto-assigned to a car!` : `${walkInName} added — assign them manually`);
      setWalkInName(""); setWalkInPhone(""); setWalkInAddress("");
      setShowWalkIn(false);
      await loadData();
    } catch { toast.error("Failed"); } finally { setWalkInLoading(false); }
  }

  function handleExportCSV() {
    const rows = [
      ["Passenger", "Phone", "Address", "Notes", "Car/Driver"].join(","),
      ...passengers.filter((p) => p.attending).map((p) => {
        const driver = drivers.find((d) => d.passengerCount > 0 && p.assignmentId);
        return [p.name, p.phone, `"${p.dropoffAddress}"`, p.notes || "", driver?.name || "Unassigned"].join(",");
      }),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temple-trip-${trip?.date?.split("T")[0]}.csv`;
    a.click();
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  }

  const attendingCount = passengers.filter((p) => p.attending && !p.markedAbsent).length;
  const assignedCount = passengers.filter((p) => p.attending && !p.markedAbsent && p.assignmentId).length;
  const availableDriverCount = drivers.filter((d) => d.available).length;
  const totalSeats = drivers.filter((d) => d.available).reduce((s, d) => s + d.seats, 0);
  const capacityOk = totalSeats >= attendingCount;
  const isLocked = trip?.status === "LOCKED" || trip?.status === "COMPLETED";
  const isGoingLocked = trip?.goingLocked ?? false;

  if (!authed) {
    return (
      <div className="page-container">
        <div className="max-w-sm mx-auto px-4 py-16 space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-2xl font-bold">Admin Access</h1>
            <p className="text-gray-500 text-sm mt-1">BAPS Temple Transport</p>
          </div>
          <div className="card space-y-3">
            <label className="label">Admin Passcode</label>
            <input type="password" placeholder="Enter passcode" value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              className="input" autoFocus />
            <button onClick={handleAuth} className="btn-primary">Enter Dashboard</button>
          </div>
          <Link href="/"><button className="btn-secondary">← Back to Home</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-bold text-gray-900">Admin Dashboard</h1>
              {trip && (
                <p className="text-xs text-gray-500">
                  {formatTripDate(trip.date)} ·{" "}
                  <span className={`font-medium ${
                    isLocked ? "text-blue-600"
                    : isGoingLocked ? "text-yellow-600"
                    : "text-green-600"
                  }`}>
                    {isLocked ? "LOCKED" : isGoingLocked ? "GOING LOCKED" : "OPEN"}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/history">
              <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">📅 History</button>
            </Link>
            <button onClick={() => { sessionStorage.removeItem("admin_auth"); setAuthed(false); }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              🚪 Log out
            </button>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="card animate-pulse h-16" />)}</div>
        ) : (
          <>
            {/* Share panel — shown after locking return */}
            {showSharePanel && trip?.assignmentSummary && (
              <div className="card bg-green-50 border-green-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-green-800">📣 Share with group</h3>
                  <button onClick={() => setShowSharePanel(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                </div>
                <pre className="text-xs text-gray-700 bg-white rounded-lg p-3 whitespace-pre-wrap border border-green-100">
                  {trip.assignmentSummary}
                </pre>
                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(trip.assignmentSummary!)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${copied ? "bg-green-500 text-white" : "bg-white border border-green-300 text-green-700 hover:bg-green-50"}`}>
                    {copied ? "✅ Copied!" : "📋 Copy"}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(trip.assignmentSummary)}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-center bg-[#25D366] text-white hover:bg-[#1eb859] transition-colors">
                    WhatsApp
                  </a>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center">
                <p className="text-2xl font-bold text-orange-500">{attendingCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Passengers</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-blue-500">{availableDriverCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Drivers</p>
              </div>
              <div className={`card text-center ${!capacityOk && attendingCount > 0 ? "bg-red-50 border-red-100" : ""}`}>
                <p className={`text-2xl font-bold ${capacityOk || attendingCount === 0 ? "text-green-500" : "text-red-500"}`}>{totalSeats}</p>
                <p className="text-xs text-gray-500 mt-0.5">Seats</p>
                {!capacityOk && attendingCount > 0 && <p className="text-xs text-red-500 mt-0.5">⚠️ {attendingCount - totalSeats} over</p>}
              </div>
            </div>

            {/* Assignment progress */}
            {assignedCount > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Assignments</span>
                  <span className="text-sm text-gray-500">{assignedCount}/{attendingCount}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${attendingCount > 0 ? (assignedCount / attendingCount) * 100 : 0}%` }} />
                </div>
                {assignedCount === attendingCount && <p className="text-xs text-green-600 mt-1.5 font-medium">✅ All passengers assigned</p>}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {/* Generate button */}
              <button onClick={handleGenerateAssignments}
                disabled={generating || attendingCount === 0 || availableDriverCount === 0 || isLocked}
                className="btn-primary">
                {generating ? "🔄 Generating..." : "⚡ Generate Car Assignments"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Link href={`/admin/assignments?tripId=${trip?.id}`}>
                  <button disabled={assignedCount === 0} className="btn-secondary disabled:opacity-40">📋 View Assignments</button>
                </Link>
                <button onClick={handleExportCSV} disabled={attendingCount === 0} className="btn-secondary disabled:opacity-40">📥 Export CSV</button>
              </div>

              {/* Walk-in button */}
              <button onClick={() => setShowWalkIn(!showWalkIn)} className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-3 px-6 rounded-xl transition-colors border border-purple-200">
                {showWalkIn ? "✕ Cancel Walk-in" : "➕ Add Walk-in Passenger"}
              </button>

              {/* Walk-in form */}
              {showWalkIn && (
                <div className="card space-y-3 border-purple-200">
                  <h3 className="font-semibold text-sm text-purple-700">Add Walk-in at Temple</h3>
                  <input type="text" placeholder="Full Name *" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} className="input" />
                  <input type="tel" placeholder="Phone Number *" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} className="input" />
                  <AddressAutocomplete
                    value={walkInAddress}
                    onChange={(addr, lat, lng) => { setWalkInAddress(addr); setWalkInLat(lat); setWalkInLng(lng); }}
                    placeholder="Dropoff address *"
                  />
                  <button onClick={handleAddWalkIn} disabled={walkInLoading} className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                    {walkInLoading ? "Adding..." : "➕ Add & Auto-assign"}
                  </button>
                </div>
              )}

              {/* Two lock buttons */}
              <div className="grid grid-cols-2 gap-2">
                {!isGoingLocked && !isLocked && (
                  <button onClick={handleLockGoing} className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-3 rounded-xl transition-colors text-sm">
                    🔒 Lock Going Trip
                  </button>
                )}
                {isGoingLocked && !isLocked && (
                  <button onClick={() => handleUnlock()} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-3 rounded-xl transition-colors text-sm">
                    🔓 Unlock Going
                  </button>
                )}
                {assignedCount > 0 && !isLocked && (
                  <button onClick={handleLockReturn} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-3 rounded-xl transition-colors text-sm">
                    🔒 Release Assignments
                  </button>
                )}
                {isLocked && (
                  <button onClick={handleUnlock} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-3 rounded-xl transition-colors text-sm">
                    🔓 Unlock Return
                  </button>
                )}
              </div>

              {/* Show share button if already locked */}
              {isLocked && trip?.assignmentSummary && !showSharePanel && (
                <button onClick={() => setShowSharePanel(true)} className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-3 rounded-xl transition-colors border border-green-200">
                  📣 Share Assignments
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setActiveTab("passengers")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "passengers" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                Passengers ({attendingCount})
              </button>
              <button onClick={() => setActiveTab("drivers")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "drivers" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                Drivers ({availableDriverCount})
              </button>
            </div>

            {/* Passengers */}
            {activeTab === "passengers" && (
              <div className="space-y-2">
                {passengers.length === 0 && <div className="card text-center py-8 text-gray-400">No passengers registered yet</div>}
                {passengers.map((p) => (
                  <div key={p.id} className={`card flex items-start gap-3 ${!p.attending || p.markedAbsent ? "opacity-50" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${p.attending ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"}`}>
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm">{p.name}</span>
                        {p.isWalkIn && <span className="badge bg-purple-100 text-purple-600">Walk-in</span>}
                        {p.returnOnly && <span className="badge bg-blue-100 text-blue-600">Return only</span>}
                        {p.markedAbsent && <span className="badge badge-red">Absent</span>}
                        {!p.markedAbsent && p.attending && p.assignmentId && <span className="badge badge-green">Assigned</span>}
                        {!p.markedAbsent && p.attending && !p.assignmentId && <span className="badge badge-orange">Unassigned</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{p.dropoffAddress}</p>
                      <p className="text-xs text-gray-400 mt-0.5">📞 {p.phone}</p>
                      {p.notes && <p className="text-xs text-blue-500 mt-0.5">📝 {p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a href={`tel:${p.phone}`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                      {p.attending && (
                        <button onClick={() => handleMarkAbsent(p.id, !p.markedAbsent)} className={`p-1.5 rounded-lg text-sm ${p.markedAbsent ? "bg-yellow-100 text-yellow-600" : "text-gray-400 hover:bg-gray-100"}`} title={p.markedAbsent ? "Mark present" : "Mark absent"}>
                          {p.markedAbsent ? "↩️" : "🚫"}
                        </button>
                      )}
                      <button onClick={() => handleDeletePassenger(p.id, p.name)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Drivers */}
            {activeTab === "drivers" && (
              <div className="space-y-2">
                {drivers.length === 0 && <div className="card text-center py-8 text-gray-400">No drivers registered yet</div>}
                {drivers.map((d) => (
                  <div key={d.id} className={`card flex items-start gap-3 ${!d.available ? "opacity-50" : ""}`}>
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {d.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{d.name}</span>
                      <p className="text-xs text-gray-500 mt-0.5">🚗 {d.carType || "Car not specified"} · {d.seats} seats</p>
                      <p className="text-xs text-gray-400 mt-0.5">📞 {d.phone}</p>
                      {d.passengerCount > 0 && <p className="text-xs text-green-600 mt-0.5">👥 {d.passengerCount}/{d.seats} assigned</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a href={`tel:${d.phone}`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                      <button onClick={() => handleDeleteDriver(d.id, d.name)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
