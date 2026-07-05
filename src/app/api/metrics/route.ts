import { NextResponse } from "next/server";
import { getOrchestrator } from "@/engine/orchestrator";
import { getEngine } from "@/engine/core/engine";
import { BufferPool } from "@/engine/core/buffer";

export async function GET() {
  try {
    const orchestrator = getOrchestrator();
    const engine = getEngine();
    const buffer = BufferPool.getInstance();

    // Get local stats
    const localHistory = orchestrator.getLocalHistory(100);
    const engineStats = await engine.engineStats();
    const optimizerStats = orchestrator.getOptimizerStats();

    // Calculate metrics from local history
    const typeDistribution: Record<string, number> = {};
    const agentPerformance: Record<string, { totalDuration: number; totalConfidence: number; count: number }> = {};

    for (const h of localHistory) {
      // Type distribution
      typeDistribution[h.queryType] = (typeDistribution[h.queryType] || 0) + 1;
    }

    // Try PostgreSQL for richer metrics, fall back to local
    try {
      const { db } = await import("@/db");
      const { queryHistory, agentLogs } = await import("@/db/schema");
      const { desc, sql, count } = await import("drizzle-orm");

      // Total queries
      const totalResult = await db.select({ count: count() }).from(queryHistory);
      const totalQueries = totalResult[0]?.count || localHistory.length;

      // Recent performance metrics
      const recentQueries = await db
        .select({
          id: queryHistory.id,
          queryType: queryHistory.queryType,
          status: queryHistory.status,
          executionTimeMs: queryHistory.executionTimeMs,
          createdAt: queryHistory.createdAt,
        })
        .from(queryHistory)
        .orderBy(desc(queryHistory.createdAt))
        .limit(10);

      // Agent performance
      const agentPerf = await db
        .select({
          agentName: agentLogs.agentName,
          avgDuration: sql<number>`AVG(${agentLogs.durationMs})`,
          avgConfidence: sql<number>`AVG(${agentLogs.confidence})`,
          totalCalls: count(),
        })
        .from(agentLogs)
        .groupBy(agentLogs.agentName);

      return NextResponse.json({
        totalQueries,
        totalTables: engineStats.tables,
        typeDistribution: Object.entries(typeDistribution).map(([queryType, count]) => ({ queryType, count })),
        agentPerformance: agentPerf,
        recentQueries,
        optimizerStats,
        buffer: buffer.stats,
        source: "postgresql",
      });
    } catch {
      // Fall back to local metrics
      return NextResponse.json({
        totalQueries: localHistory.length,
        totalTables: engineStats.tables,
        typeDistribution: Object.entries(typeDistribution).map(([queryType, count]) => ({ queryType, count })),
        agentPerformance: [],
        recentQueries: localHistory.slice(0, 10).map((h) => ({
          id: h.id,
          queryType: h.queryType,
          status: h.status,
          executionTimeMs: h.executionTimeMs,
          createdAt: h.createdAt,
        })),
        optimizerStats,
        buffer: buffer.stats,
        source: "local",
      });
    }
  } catch (error) {
    console.error("Metrics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
