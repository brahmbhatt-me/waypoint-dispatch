import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/assignments?tripId=...  — all assignments for a trip
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  try {
    const assignments = await prisma.assignment.findMany({
      where: { tripId },
      include: {
        driverSession: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        passengers: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = assignments.map((a) => {
      const stopOrder = (a.stopOrder as string[]) ?? [];
      const passengerMap = new Map(a.passengers.map((p) => [p.id, p]));
      const ordered = [
        ...stopOrder.map((id) => passengerMap.get(id)).filter(Boolean),
        ...a.passengers.filter((p) => !stopOrder.includes(p.id)),
      ] as typeof a.passengers;

      return {
        id: a.id,
        tripId: a.tripId,
        isLocked: a.isLocked,
        mapsUrl: a.mapsUrl,
        estimatedMinutes: a.estimatedMinutes,
        driver: {
          sessionId: a.driverSession.id,
          userId: a.driverSession.user.id,
          name: a.driverSession.user.name,
          phone: a.driverSession.user.phone,
          carType: a.driverSession.carType,
          seats: a.driverSession.seats,
        },
        passengers: ordered.map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.user.name,
          phone: p.user.phone,
          dropoffAddress: p.dropoffAddress,
          notes: p.notes,
        })),
      };
    });

    return NextResponse.json(formatted);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}
