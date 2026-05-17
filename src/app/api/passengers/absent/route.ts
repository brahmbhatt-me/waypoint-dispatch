import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/passengers/absent — mark passenger absent on the day
export async function POST(req: NextRequest) {
  try {
    const { attendanceId, absent, adminCode } = await req.json();

    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { markedAbsent: absent },
    });

    return NextResponse.json({ success: true, markedAbsent: updated.markedAbsent });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
