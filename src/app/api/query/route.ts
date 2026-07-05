import { NextRequest, NextResponse } from "next/server";
import { getOrchestrator } from "@/engine/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sql } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'sql' field" },
        { status: 400 }
      );
    }

    if (sql.trim().length === 0) {
      return NextResponse.json(
        { error: "SQL query cannot be empty" },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();
    const result = await orchestrator.executeQuery(sql);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("Query API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
