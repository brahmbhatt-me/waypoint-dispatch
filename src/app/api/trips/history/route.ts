import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: { date: "desc" },
      include: {
        _count: {
          select: {
            attendances: { where: { attending: true } },
            driverSessions: { where: { available: true } },
            assignments: true,
          },
        },
      },
    });

    return NextResponse.json(
      trips.map((t) => ({
        id: t.id,
        date: t.date,
        status: t.status,
        passengerCount: t._count.attendances,
        driverCount: t._count.driverSessions,
        assignmentCount: t._count.assignments,
      }))
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}
