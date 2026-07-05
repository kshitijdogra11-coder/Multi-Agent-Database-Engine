import { NextResponse } from "next/server";
import { getEngine } from "@/engine/core/engine";
import { BufferPool } from "@/engine/core/buffer";

export async function GET() {
  try {
    const engine = getEngine();
    const stats = await engine.engineStats();
    const buffer = BufferPool.getInstance();
    return NextResponse.json({
      ...stats,
      buffer: buffer.stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read engine stats", message: String(error) },
      { status: 500 }
    );
  }
}
