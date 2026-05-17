import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, getThisSaturday } from "@/lib/utils";
import { geocodeAddress } from "@/lib/maps";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  const phone = searchParams.get("phone");

  try {
    if (phone) {
      const normalized = normalizePhone(phone);
      const user = await prisma.user.findUnique({
        where: { phone: normalized },
        select: { id: true, name: true, phone: true, role: true },
      });
      return NextResponse.json(user ?? null);
    }

    if (tripId) {
      const sessions = await prisma.driverSession.findMany({
        where: { tripId, available: true },
        include: {
          user: { select: { name: true, phone: true } },
          assignment: { include: { _count: { select: { passengers: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(
        sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          name: s.user.name,
          phone: s.user.phone,
          carType: s.carType,
          seats: s.seats,
          available: s.available,
          startAddress: s.startAddress,
          notes: s.notes,
          assignmentId: s.assignment?.id ?? null,
          passengerCount: s.assignment?._count.passengers ?? 0,
        }))
      );
    }

    return NextResponse.json({ error: "Provide tripId" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, phone, seats, carType, startAddress, startLat, startLng, notes } = await req.json();

    if (!name || !phone || !seats) {
      return NextResponse.json({ error: "Name, phone, and seats required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const saturday = getThisSaturday();

    // Geocode start address if needed
    let finalStartLat = startLat ?? null;
    let finalStartLng = startLng ?? null;
    let finalStartAddress = startAddress;
    if (startAddress && !finalStartLat) {
      const geo = await geocodeAddress(startAddress);
      if (geo) { finalStartAddress = geo.address; finalStartLat = geo.lat; finalStartLng = geo.lng; }
    }

    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: { name, role: "DRIVER" },
      create: { name, phone: normalizedPhone, role: "DRIVER" },
    });

    const trip = await prisma.trip.upsert({
      where: { date: saturday },
      update: {},
      create: { date: saturday, status: "OPEN" },
    });

    if (trip.status === "LOCKED") {
      return NextResponse.json({ error: "Assignments are locked." }, { status: 403 });
    }

    const session = await prisma.driverSession.upsert({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
      update: { seats, carType, startAddress: finalStartAddress, startLat: finalStartLat, startLng: finalStartLng, notes, available: true },
      create: { userId: user.id, tripId: trip.id, seats, carType, startAddress: finalStartAddress, startLat: finalStartLat, startLng: finalStartLng, notes, available: true },
    });

    return NextResponse.json({ success: true, sessionId: session.id, userId: user.id, tripDate: saturday });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
