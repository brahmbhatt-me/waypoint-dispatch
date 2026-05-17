import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps";
import { normalizePhone, getThisSaturday } from "@/lib/utils";

// POST /api/passengers/walkin — admin adds a walk-in passenger at the temple
export async function POST(req: NextRequest) {
  try {
    const { name, phone, dropoffAddress, dropoffLat, dropoffLng, adminCode } = await req.json();

    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!name || !phone || !dropoffAddress) {
      return NextResponse.json({ error: "Name, phone, address required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const saturday = getThisSaturday();

    // Geocode if needed
    let finalLat = dropoffLat ?? null;
    let finalLng = dropoffLng ?? null;
    let finalAddress = dropoffAddress;
    if (!finalLat || !finalLng) {
      const geo = await geocodeAddress(dropoffAddress);
      if (geo) { finalAddress = geo.address; finalLat = geo.lat; finalLng = geo.lng; }
    }

    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: { name },
      create: { name, phone: normalizedPhone },
    });

    const trip = await prisma.trip.findUnique({ where: { date: saturday } });
    if (!trip) return NextResponse.json({ error: "No active trip" }, { status: 404 });

    const attendance = await prisma.attendance.upsert({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
      update: {
        dropoffAddress: finalAddress,
        dropoffLat: finalLat,
        dropoffLng: finalLng,
        attending: true,
        isWalkIn: true,
        returnOnly: true,
        assignmentId: null,
      },
      create: {
        userId: user.id,
        tripId: trip.id,
        dropoffAddress: finalAddress,
        dropoffLat: finalLat,
        dropoffLng: finalLng,
        attending: true,
        isWalkIn: true,
        returnOnly: true,
      },
    });

    // Auto-assign to car with most available space
    const assignments = await prisma.assignment.findMany({
      where: { tripId: trip.id },
      include: {
        _count: { select: { passengers: true } },
        driverSession: true,
      },
    });

    if (assignments.length > 0) {
      const bestCar = assignments
        .filter((a) => a._count.passengers < a.driverSession.seats)
        .sort((a, b) => (b.driverSession.seats - b._count.passengers) - (a.driverSession.seats - a._count.passengers))[0];

      if (bestCar) {
        await prisma.attendance.update({
          where: { id: attendance.id },
          data: { assignmentId: bestCar.id },
        });
        return NextResponse.json({
          success: true,
          attendanceId: attendance.id,
          autoAssigned: true,
          assignedCar: bestCar.id,
        });
      }
    }

    return NextResponse.json({ success: true, attendanceId: attendance.id, autoAssigned: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add walk-in" }, { status: 500 });
  }
}
