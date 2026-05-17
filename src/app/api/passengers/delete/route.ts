import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { attendanceId, adminCode } = await req.json();
    if (adminCode !== (process.env.ADMIN_PASSCODE || "baps2024")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await prisma.attendance.delete({ where: { id: attendanceId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
