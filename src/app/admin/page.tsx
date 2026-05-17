"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatTripDate } from "@/lib/utils";

interface Trip {
  id: string;
  date: string;
  status: string;
  passengerCount: number;
  driverCount: number;
  totalSeats: number;
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
  useEffect(() => { if (sessionStorage.getItem("admin_auth") === "true") setAuthed(true); }, []);

  function handleAuth() {
    if (passcode === ADMIN_CODE) {
      setAuthed(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      toast.error("Incorrect passcode");
    }
  }

  async function handleGenerateAssignments() {
    if (!trip) return;
    if (!confirm(`Generate assignments for ${passengers.filter((p) => p.attending).length} passengers across ${drivers.filter((d) => d.available).length} cars?`)) return;
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

  async function handleLockTrip() {
    if (!trip) return;
    if (!confirm("Lock assignments? No more changes can be made.")) return;
    try {
      await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, status: "LOCKED" }),
      });
      toast.success("🔒 Trip locked!");
      await loadData();
    } catch {
      toast.error("Failed to lock trip");
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
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDeletePassenger(attendanceId: string, name: string) {
    if (!confirm(`Remove ${name} from this trip?`)) return;
    try {
      const res = await fetch("/api/passengers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, adminCode: ADMIN_CODE }),
      });
      if (!res.ok) { toast.error("Failed to delete"); return; }
      toast.success(`${name} removed`);
      await loadData();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleDeleteDriver(sessionId: string, name: string) {
    if (!confirm(`Remove ${name} as driver for this trip?`)) return;
    try {
      const res = await fetch("/api/drivers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, adminCode: ADMIN_CODE }),
      });
      if (!res.ok) { toast.error("Failed to delete"); return; }
      toast.success(`${name} removed`);
      await loadData();
    } catch {
      toast.error("Failed to delete");
    }
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

  const attendingCount = passengers.filter((p) => p.attending).length;
  const assignedCount = passengers.filter((p) => p.attending && p.assignmentId).length;
  const availableDriverCount = drivers.filter((d) => d.available).length;
  const totalSeats = drivers.filter((d) => d.available).reduce((s, d) => s + d.seats, 0);
  const capacityOk = totalSeats >= attendingCount;

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
                  <span className={`font-medium ${trip.status === "LOCKED" ? "text-blue-600" : trip.status === "OPEN" ? "text-green-600" : "text-orange-500"}`}>
                    {trip.status}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/history">
              <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
                📅 History
              </button>
            </Link>
            <button onClick={loadData} className="text-gray-400 hover:text-gray-600 p-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="card animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2" /><div className="h-4 bg-gray-200 rounded w-1/3" /></div>)}
          </div>
        ) : (
          <>
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
                <p className="text-xs text-gray-500 mt-0.5">Total Seats</p>
                {!capacityOk && attendingCount > 0 && <p className="text-xs text-red-500 mt-1">⚠️ {attendingCount - totalSeats} over</p>}
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
                  <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${(assignedCount / attendingCount) * 100}%` }} />
                </div>
                {assignedCount === attendingCount && <p className="text-xs text-green-600 mt-1.5 font-medium">✅ All passengers assigned</p>}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button onClick={handleGenerateAssignments} disabled={generating || attendingCount === 0 || availableDriverCount === 0 || trip?.status === "LOCKED"} className="btn-primary">
                {generating ? "🔄 Generating..." : "⚡ Generate Car Assignments"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/admin/assignments?tripId=${trip?.id}`}>
                  <button disabled={assignedCount === 0} className="btn-secondary disabled:opacity-40">📋 View Assignments</button>
                </Link>
                <button onClick={handleExportCSV} disabled={attendingCount === 0} className="btn-secondary disabled:opacity-40">📥 Export CSV</button>
              </div>
              {assignedCount > 0 && trip?.status !== "LOCKED" && (
                <button onClick={handleLockTrip} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                  🔒 Lock &amp; Finalize Assignments
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

            {/* Passengers list */}
            {activeTab === "passengers" && (
              <div className="space-y-2">
                {passengers.length === 0 && <div className="card text-center py-8 text-gray-400">No passengers registered yet</div>}
                {passengers.map((p) => (
                  <div key={p.id} className={`card flex items-start gap-3 ${!p.attending || p.markedAbsent ? "opacity-50" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${p.attending ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"}`}>
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.name}</span>
                        {!p.attending && <span className="badge badge-gray">Not attending</span>}
                        {p.markedAbsent && <span className="badge badge-red">Absent today</span>}
                        {p.attending && !p.markedAbsent && p.assignmentId && <span className="badge badge-green">Assigned</span>}
                        {p.attending && !p.markedAbsent && !p.assignmentId && <span className="badge badge-orange">Unassigned</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{p.dropoffAddress}</p>
                      {p.notes && <p className="text-xs text-blue-500 mt-0.5">📝 {p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a href={`tel:${p.phone}`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Call">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                      {p.attending && (
                        <button onClick={() => handleMarkAbsent(p.id, !p.markedAbsent)} className={`p-1.5 rounded-lg text-sm ${p.markedAbsent ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200" : "text-gray-400 hover:bg-gray-100"}`} title={p.markedAbsent ? "Mark present" : "Mark absent today"}>
                          {p.markedAbsent ? "↩️" : "🚫"}
                        </button>
                      )}
                      <button onClick={() => handleDeletePassenger(p.id, p.name)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" title="Remove from this trip">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Drivers list */}
            {activeTab === "drivers" && (
              <div className="space-y-2">
                {drivers.length === 0 && <div className="card text-center py-8 text-gray-400">No drivers registered yet</div>}
                {drivers.map((d) => (
                  <div key={d.id} className={`card flex items-start gap-3 ${!d.available ? "opacity-50" : ""}`}>
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {d.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.name}</span>
                        {!d.available && <span className="badge badge-gray">Unavailable</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">🚗 {d.carType || "Car not specified"} · {d.seats} seats</p>
                      {d.passengerCount > 0 && <p className="text-xs text-green-600 mt-0.5">👥 {d.passengerCount}/{d.seats} assigned</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a href={`tel:${d.phone}`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Call">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                      <button onClick={() => handleDeleteDriver(d.id, d.name)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500" title="Remove driver">
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
