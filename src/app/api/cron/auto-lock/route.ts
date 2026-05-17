import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Runs every Sunday at 4 AM UTC (midnight EST)
// Auto-locks any Saturday trips that have assignments
export async function GET(req: NextRequest) {
  // Verify it's coming from Vercel cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all OPEN trips that are in the past and have assignments
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tripsToLock = await prisma.trip.findMany({
      where: {
        date: { lt: yesterday },
        status: { in: ["OPEN", "GOING_LOCKED"] },
        assignments: { some: {} },
      },
    });

    await Promise.all(
      tripsToLock.map((trip) =>
        prisma.trip.update({
          where: { id: trip.id },
          data: { status: "COMPLETED" },
        })
      )
    );

    return NextResponse.json({
      success: true,
      lockedCount: tripsToLock.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
