import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, getThisSaturday } from "@/lib/utils";

// GET /api/unregister?phone=... — look up registration
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json(null);

  try {
    const normalized = normalizePhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) return NextResponse.json(null);

    const saturday = getThisSaturday();
    const trip = await prisma.trip.findUnique({ where: { date: saturday } });
    if (!trip) return NextResponse.json(null);

    const isLocked = trip.status === "LOCKED" || trip.status === "COMPLETED";

    const attendance = await prisma.attendance.findUnique({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
    });

    const driverSession = await prisma.driverSession.findUnique({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
    });

    if (!attendance && !driverSession) return NextResponse.json(null);

    return NextResponse.json({
      attendanceId: attendance?.id ?? null,
      driverSessionId: driverSession?.id ?? null,
      name: user.name,
      attending: attendance?.attending ?? false,
      dropoffAddress: attendance?.dropoffAddress ?? "",
      tripDate: trip.date,
      isLocked,
      isDriver: !!driverSession,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(null);
  }
}

// POST /api/unregister — cancel registration
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    const normalized = normalizePhone(phone);

    const user = await prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const saturday = getThisSaturday();
    const trip = await prisma.trip.findUnique({ where: { date: saturday } });
    if (!trip) return NextResponse.json({ error: "No active trip" }, { status: 404 });

    if (trip.status === "LOCKED" || trip.status === "COMPLETED") {
      return NextResponse.json({ error: "Trip is locked" }, { status: 403 });
    }

    // Delete attendance
    await prisma.attendance.deleteMany({
      where: { userId: user.id, tripId: trip.id },
    });

    // Mark driver session as unavailable (soft delete)
    await prisma.driverSession.updateMany({
      where: { userId: user.id, tripId: trip.id },
      data: { available: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
