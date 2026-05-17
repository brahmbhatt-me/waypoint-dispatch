import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getThisSaturday } from "@/lib/utils";

export async function GET() {
  try {
    const saturday = getThisSaturday();

    // Default going cutoff = Friday 11pm EST
    const goingCutoff = new Date(saturday);
    goingCutoff.setDate(goingCutoff.getDate() - 1); // Friday
    goingCutoff.setHours(23, 0, 0, 0);

    const trip = await prisma.trip.upsert({
      where: { date: saturday },
      update: {},
      create: { date: saturday, status: "OPEN", goingCutoff },
      include: {
        _count: {
          select: {
            attendances: { where: { attending: true } },
            driverSessions: { where: { available: true } },
          },
        },
        driverSessions: {
          where: { available: true },
          select: { seats: true },
        },
      },
    });

    const totalSeats = trip.driverSessions.reduce((s, d) => s + d.seats, 0);
    const now = new Date();
    const goingLocked = trip.status === "GOING_LOCKED" || trip.status === "LOCKED" || trip.status === "COMPLETED"
      || (trip.goingCutoff ? now > trip.goingCutoff : false);

    return NextResponse.json({
      ...trip,
      passengerCount: trip._count.attendances,
      driverCount: trip._count.driverSessions,
      totalSeats,
      goingLocked,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to get trip" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tripId, status, notes, action } = await req.json();

    if (action === "lock_going") {
      const trip = await prisma.trip.update({
        where: { id: tripId },
        data: { status: "GOING_LOCKED" },
      });
      return NextResponse.json(trip);
    }

    if (action === "lock_return") {
      // Generate assignment summary for group chat
      const assignments = await prisma.assignment.findMany({
        where: { tripId },
        include: {
          driverSession: { include: { user: { select: { name: true } } } },
          passengers: { include: { user: { select: { name: true } } } },
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://waypoint-dispatch.vercel.app";
      const lines = [
        "🛕 *Return Trip Assignments Ready!*",
        "",
        ...assignments
          .filter((a) => a.passengers.length > 0)
          .map((a, i) => {
            const names = a.passengers.map((p) => p.user.name).join(", ");
            return `🚗 *Car ${i + 1} — ${a.driverSession.user.name}:* ${names}`;
          }),
        "",
        `🔍 Check your car: ${appUrl}/my-assignment`,
        "",
        "Jay Swaminarayan 🙏",
      ];

      const summary = lines.join("\n");

      const trip = await prisma.trip.update({
        where: { id: tripId },
        data: { status: "LOCKED", assignmentSummary: summary },
      });
      return NextResponse.json({ ...trip, assignmentSummary: summary });
    }

    if (action === "unlock") {
      const trip = await prisma.trip.update({
        where: { id: tripId },
        data: { status: "OPEN" },
      });
      return NextResponse.json(trip);
    }

    if (action === "unlock_going") {
      const trip = await prisma.trip.update({
        where: { id: tripId },
        data: { status: "OPEN" },
      });
      return NextResponse.json(trip);
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: { status, notes },
    });
    return NextResponse.json(trip);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}
