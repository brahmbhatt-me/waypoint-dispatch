import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, getThisSaturday } from "@/lib/utils";

// GET /api/drivers?tripId=...
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
          assignment: {
            include: {
              passengers: {
                include: { user: { select: { name: true } } },
              },
            },
          },
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
          notes: s.notes,
          assignmentId: s.assignment?.id ?? null,
          passengerCount: s.assignment?.passengers.length ?? 0,
        }))
      );
    }

    return NextResponse.json({ error: "Provide tripId" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

// POST /api/drivers — register driver availability
export async function POST(req: NextRequest) {
  try {
    const { name, phone, seats, carType, notes } = await req.json();

    if (!name || !phone || !seats) {
      return NextResponse.json({ error: "Name, phone, and seats required" }, { status: 400 });
    }

    if (seats < 1 || seats > 10) {
      return NextResponse.json({ error: "Seats must be between 1 and 10" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const saturday = getThisSaturday();

    // Upsert user (mark as DRIVER role)
    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: { name, role: "DRIVER" },
      create: { name, phone: normalizedPhone, role: "DRIVER" },
    });

    // Upsert trip
    const trip = await prisma.trip.upsert({
      where: { date: saturday },
      update: {},
      create: { date: saturday, status: "OPEN" },
    });

    if (trip.status === "LOCKED") {
      return NextResponse.json(
        { error: "Assignments are locked. Contact the organizer." },
        { status: 403 }
      );
    }

    // Upsert driver session
    const session = await prisma.driverSession.upsert({
      where: { userId_tripId: { userId: user.id, tripId: trip.id } },
      update: { seats, carType, notes, available: true },
      create: {
        userId: user.id,
        tripId: trip.id,
        seats,
        carType,
        notes,
        available: true,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      userId: user.id,
      tripDate: saturday,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

// PATCH /api/drivers — update availability or seats
export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, available, seats, carType } = await req.json();

    const updated = await prisma.driverSession.update({
      where: { id: sessionId },
      data: { available, seats, carType },
    });

    return NextResponse.json({ success: true, session: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
