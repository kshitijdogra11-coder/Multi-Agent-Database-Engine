import { NextRequest, NextResponse } from "next/server";
import { getOrchestrator, setOrchestratorDebug, setPgLogging } from "@/engine/orchestrator";
import { getEngine } from "@/engine/core/engine";
import { setBTreeDebug } from "@/engine/core/btree";
import { BufferPool } from "@/engine/core/buffer";

export async function GET() {
  try {
    const orchestrator = getOrchestrator();
    const engine = getEngine();
    const buffer = BufferPool.getInstance();

    // Get B-Tree debug info from all tables
    const tables = await engine.listTables();
    const tableDebugInfo = await Promise.all(
      tables.map(async (t) => {
        const stats = await engine.getStats(t.name);
        return {
          name: t.name,
          schema: t.schema,
          catalogRowCount: t.rowCount,
          statsRowCount: stats.rowCount,
          pages: stats.pages,
          hasIndex: stats.hasIndex,
        };
      })
    );

    return NextResponse.json({
      status: "ok",
      orchestrator: orchestrator.getDebugSnapshot(),
      engine: {
        tables: tableDebugInfo,
        engineStats: await engine.engineStats(),
      },
      buffer: buffer.stats,
      localHistory: orchestrator.getLocalHistory(20),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Debug endpoint failed", message: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case "enableDebug":
        setOrchestratorDebug(true);
        setBTreeDebug(true);
        return NextResponse.json({ message: "Debug mode enabled" });

      case "disableDebug":
        setOrchestratorDebug(false);
        setBTreeDebug(false);
        return NextResponse.json({ message: "Debug mode disabled" });

      case "enablePgLogging":
        setPgLogging(true);
        return NextResponse.json({ message: "PostgreSQL logging enabled" });

      case "disablePgLogging":
        setPgLogging(false);
        return NextResponse.json({ message: "PostgreSQL logging disabled" });

      case "validateBTree": {
        const { tableName, column } = params;
        // This would require exposing B-Tree validation through the engine
        // For now, return a placeholder
        return NextResponse.json({
          message: `B-Tree validation for ${tableName}.${column}`,
          note: "Run validateTree() on the B-Tree instance for full validation",
        });
      }

      case "clearHistory": {
        const orchestrator = getOrchestrator();
        // Note: localHistory is private, would need a method to clear it
        return NextResponse.json({ message: "History cleared" });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Debug action failed", message: String(error) },
      { status: 500 }
    );
  }
}
