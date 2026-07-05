import { NextResponse } from "next/server";
import { getOrchestrator } from "@/engine/orchestrator";

export async function GET() {
  try {
    // Try PostgreSQL first if available
    try {
      const { db } = await import("@/db");
      const { queryHistory } = await import("@/db/schema");
      const { desc } = await import("drizzle-orm");

      const history = await db
        .select()
        .from(queryHistory)
        .orderBy(desc(queryHistory.createdAt))
        .limit(50);

      return NextResponse.json({ history, source: "postgresql" });
    } catch {
      // Fall back to local history
      const orchestrator = getOrchestrator();
      const history = orchestrator.getLocalHistory(50);
      return NextResponse.json({ history, source: "local" });
    }
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history", history: [] },
      { status: 500 }
    );
  }
}
