import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/assignments/[id] — get a single assignment with full details
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        driverSession: {
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
        passengers: {
          include: { user: { select: { name: true, phone: true } } },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Reconstruct ordered passenger list from stopOrder
    const stopOrder = (assignment.stopOrder as string[]) ?? [];
    const passengerMap = new Map(
      assignment.passengers.map((p) => [p.id, p])
    );
    const orderedPassengers = stopOrder
      .map((id) => passengerMap.get(id))
      .filter(Boolean);
    // Add any not in stopOrder at the end
    const unordered = assignment.passengers.filter((p) => !stopOrder.includes(p.id));
    const allPassengers = [...orderedPassengers, ...unordered];

    return NextResponse.json({
      id: assignment.id,
      tripId: assignment.tripId,
      isLocked: assignment.isLocked,
      mapsUrl: assignment.mapsUrl,
      estimatedMinutes: assignment.estimatedMinutes,
      driver: {
        sessionId: assignment.driverSession.id,
        userId: assignment.driverSession.user.id,
        name: assignment.driverSession.user.name,
        phone: assignment.driverSession.user.phone,
        carType: assignment.driverSession.carType,
        seats: assignment.driverSession.seats,
      },
      passengers: allPassengers.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        phone: p.user.phone,
        dropoffAddress: p.dropoffAddress,
        dropoffLat: p.dropoffLat,
        dropoffLng: p.dropoffLng,
        notes: p.notes,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch assignment" }, { status: 500 });
  }
}

// PATCH /api/assignments/[id] — manual override: move passenger, update route, lock
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { action, adminCode } = body;

    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "lock") {
      const updated = await prisma.assignment.update({
        where: { id: params.id },
        data: { isLocked: true },
      });
      return NextResponse.json({ success: true, isLocked: updated.isLocked });
    }

    if (action === "unlock") {
      const updated = await prisma.assignment.update({
        where: { id: params.id },
        data: { isLocked: false },
      });
      return NextResponse.json({ success: true, isLocked: updated.isLocked });
    }

    // Move passenger from this assignment to another
    if (action === "move_passenger") {
      const { attendanceId, toAssignmentId } = body;

      // Verify target assignment has capacity
      const target = await prisma.assignment.findUnique({
        where: { id: toAssignmentId },
        include: {
          _count: { select: { passengers: true } },
          driverSession: true,
        },
      });

      if (!target) {
        return NextResponse.json({ error: "Target assignment not found" }, { status: 404 });
      }

      if (target._count.passengers >= target.driverSession.seats) {
        return NextResponse.json({ error: "Target car is full" }, { status: 400 });
      }

      await prisma.attendance.update({
        where: { id: attendanceId },
        data: { assignmentId: toAssignmentId },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// GET all assignments for a trip
export { GET as default };
