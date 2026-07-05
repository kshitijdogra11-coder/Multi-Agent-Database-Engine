// Orchestrator Agent: Central coordinator for the multi-agent pipeline
import { v4 as uuidv4 } from "uuid";
import { ParserAgent } from "./agents/parser";
import { SecurityAgent } from "./agents/security";
import { PlannerAgent } from "./agents/planner";
import { OptimizerAgent } from "./agents/optimizer";
import { ExecutorAgent } from "./agents/executor";
import { ValidatorAgent } from "./agents/validator";
import type { AgentResult, ExecutionResult, AgentContext } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG & LOGGING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

let DEBUG_ORCHESTRATOR = process.env.DEBUG_ORCHESTRATOR === "true";
let ENABLE_PG_LOGGING = process.env.ENABLE_PG_LOGGING === "true";

export function setOrchestratorDebug(enabled: boolean): void {
  DEBUG_ORCHESTRATOR = enabled;
}

export function setPgLogging(enabled: boolean): void {
  ENABLE_PG_LOGGING = enabled;
}

function debugLog(...args: unknown[]): void {
  if (DEBUG_ORCHESTRATOR) {
    console.log("[Orchestrator]", ...args);
  }
}

// Lazy-load Drizzle only if PG logging is enabled
async function getDb() {
  if (!ENABLE_PG_LOGGING) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch (e) {
    console.warn("[Orchestrator] PostgreSQL not available, disabling logging:", e);
    ENABLE_PG_LOGGING = false;
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class Orchestrator {
  readonly name = "Orchestrator Agent";

  private parser = new ParserAgent();
  private security = new SecurityAgent();
  private planner = new PlannerAgent();
  private optimizer = new OptimizerAgent();
  private executor = new ExecutorAgent();
  private validator = new ValidatorAgent();

  // In-memory query history (when PG logging is disabled)
  private localHistory: Array<{
    id: number;
    sql: string;
    result: ExecutionResult;
    timestamp: Date;
  }> = [];
  private historyIdCounter = 0;

  async executeQuery(sql: string): Promise<ExecutionResult> {
    const context: AgentContext = {
      queryId: uuidv4(),
      retryCount: 0,
      maxRetries: 3,
      startTime: performance.now(),
    };

    const pipeline: AgentResult[] = [];

    debugLog("═══════════════════════════════════════════════════════════════");
    debugLog("QUERY:", sql);
    debugLog("Query ID:", context.queryId);

    try {
      // ── STEP 1: Parse ──
      debugLog("Step 1: Parsing...");
      const parseStart = performance.now();
      const { parsed, confidence, errors } = this.parser.parse(sql);
      const parseDuration = performance.now() - parseStart;

      pipeline.push({
        agentName: "Parser Agent",
        status: errors.length > 0 ? "error" : "success",
        data: { parsed, confidence, errors },
        confidence,
        durationMs: parseDuration,
        message: errors.length > 0 ? errors.join("; ") : `Parsed ${parsed.type} query`,
      });

      debugLog("  Parsed type:", parsed.type, "confidence:", confidence.toFixed(2));
      if (errors.length > 0) debugLog("  Errors:", errors);

      if (errors.length > 0 || confidence < 0.3) {
        return this.buildResult(false, undefined, 0, errors.join("; "), pipeline, context, parsed.type);
      }

      // ── STEP 2: Security Check ──
      debugLog("Step 2: Security check...");
      const secStart = performance.now();
      const secResult = this.security.validate(parsed);
      const secDuration = performance.now() - secStart;

      pipeline.push({
        agentName: "Security Agent",
        status: secResult.safe ? "success" : "error",
        data: secResult,
        confidence: 1 - secResult.riskScore / 100,
        durationMs: secDuration,
        message: secResult.safe
          ? `Security check passed (risk: ${secResult.riskScore}%)`
          : `Security threat: ${secResult.threats.join("; ")}`,
      });

      debugLog("  Safe:", secResult.safe, "Risk score:", secResult.riskScore);
      if (secResult.threats.length > 0) debugLog("  Threats:", secResult.threats);

      if (!secResult.safe) {
        return this.buildResult(false, undefined, 0, `Security violation: ${secResult.threats.join("; ")}`, pipeline, context, parsed.type);
      }

      // ── STEP 3: Get Table Stats (for planner) ──
      let tableStats = { rowCount: 0, hasIndex: false };
      if (parsed.table) {
        debugLog("Step 3: Getting table stats for:", parsed.table);
        tableStats = await this.executor.getTableStats(parsed.table);
        debugLog("  Stats:", tableStats);
      }

      // ── STEP 4: Plan ──
      debugLog("Step 4: Planning...");
      const planStart = performance.now();
      const plan = this.planner.createPlan(parsed, tableStats);
      const planDuration = performance.now() - planStart;

      pipeline.push({
        agentName: "Planner Agent",
        status: "success",
        data: plan,
        confidence: 0.9,
        durationMs: planDuration,
        message: `Created ${plan.strategy} plan with ${plan.steps.length} steps (est. cost: ${plan.estimatedCost.toFixed(1)})`,
      });

      debugLog("  Strategy:", plan.strategy);
      debugLog("  Steps:", plan.steps.length);
      debugLog("  Est. cost:", plan.estimatedCost);

      // ── STEP 5: ML Optimization ──
      debugLog("Step 5: ML optimization...");
      const optStart = performance.now();
      const queryPattern = `${parsed.type}:${parsed.table || ""}:${parsed.conditions?.length || 0}`;
      const { optimizedPlan, improvements } = this.optimizer.optimize(plan, queryPattern);
      const optDuration = performance.now() - optStart;

      pipeline.push({
        agentName: "ML Optimizer Agent",
        status: improvements.length > 0 ? "success" : "warning",
        data: { improvements, optimizedCost: optimizedPlan.estimatedCost },
        confidence: improvements.length > 0 ? 0.85 : 0.5,
        durationMs: optDuration,
        message: improvements.length > 0 ? improvements.join("; ") : "No optimizations applicable",
      });

      debugLog("  Improvements:", improvements);
      debugLog("  Optimized cost:", optimizedPlan.estimatedCost);

      // ── STEP 6: Execute ──
      debugLog("Step 6: Executing...");
      const execStart = performance.now();
      const execResult = await this.executor.execute(parsed, optimizedPlan);
      const execDuration = performance.now() - execStart;

      pipeline.push({
        agentName: "Executor Agent",
        status: "success",
        data: { rowCount: execResult.rowCount },
        confidence: 1.0,
        durationMs: execDuration,
        message: `Executed successfully — ${execResult.rowCount} row(s) affected/returned`,
      });

      debugLog("  Rows:", execResult.rowCount);
      debugLog("  Duration:", execDuration.toFixed(2), "ms");

      // ── STEP 7: Validate ──
      debugLog("Step 7: Validating...");
      const valStart = performance.now();
      const validation = this.validator.validate(parsed, execResult);
      const valDuration = performance.now() - valStart;

      pipeline.push({
        agentName: "Validator Agent",
        status: validation.valid ? "success" : "warning",
        data: validation,
        confidence: validation.valid ? 1.0 : 0.7,
        durationMs: valDuration,
        message: validation.valid
          ? "Result validation passed"
          : `Issues: ${validation.issues.join("; ")}`,
      });

      debugLog("  Valid:", validation.valid);
      if (validation.issues.length > 0) debugLog("  Issues:", validation.issues);
      if (validation.suggestions.length > 0) debugLog("  Suggestions:", validation.suggestions);

      // ── STEP 8: Learn (ML feedback loop) ──
      const actualCost = execDuration;
      this.optimizer.learn(
        queryPattern,
        optimizedPlan.estimatedCost,
        actualCost,
        optimizedPlan.steps[0]?.estimatedRows || 0,
        execResult.rowCount
      );
      debugLog("Step 8: ML learning recorded for pattern:", queryPattern);

      // ── Build and log result ──
      const result = this.buildResult(true, execResult.data, execResult.rowCount, undefined, pipeline, context, parsed.type);
      
      debugLog("═══════════════════════════════════════════════════════════════");
      debugLog("RESULT: Success, rows:", result.rowCount, "time:", result.executionTimeMs.toFixed(2), "ms");

      // Log to PostgreSQL (if enabled) or local history
      await this.logExecution(result, sql, context);

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      debugLog("ERROR:", errMsg);
      if (DEBUG_ORCHESTRATOR && error instanceof Error && error.stack) {
        debugLog("Stack:", error.stack);
      }

      pipeline.push({
        agentName: "Error Handler",
        status: "error",
        data: { error: errMsg },
        confidence: 0,
        durationMs: 0,
        message: errMsg,
      });

      // Retry logic
      if (context.retryCount < context.maxRetries && this.isRetryable(errMsg)) {
        context.retryCount++;
        debugLog("Retrying (attempt", context.retryCount, "/", context.maxRetries, ")");
        pipeline.push({
          agentName: "Orchestrator",
          status: "warning",
          data: { retry: context.retryCount },
          confidence: 0.5,
          durationMs: 0,
          message: `Retrying (attempt ${context.retryCount}/${context.maxRetries})`,
        });
        // Note: In production, you'd actually retry here
      }

      const result = this.buildResult(false, undefined, 0, errMsg, pipeline, context, "UNKNOWN");
      await this.logExecution(result, sql, context).catch(() => {});
      return result;
    }
  }

  private isRetryable(error: string): boolean {
    const retryablePatterns = ["deadlock", "connection", "timeout", "lock"];
    return retryablePatterns.some((p) => error.toLowerCase().includes(p));
  }

  private buildResult(
    success: boolean,
    data: unknown,
    rowCount: number,
    error: string | undefined,
    pipeline: AgentResult[],
    context: AgentContext,
    queryType: string
  ): ExecutionResult {
    return {
      success,
      data,
      rowCount,
      error,
      pipeline,
      executionTimeMs: performance.now() - context.startTime,
      queryType: queryType as ExecutionResult["queryType"],
    };
  }

  private async logExecution(result: ExecutionResult, sql: string, context: AgentContext): Promise<void> {
    // Always log to local history
    this.localHistory.unshift({
      id: ++this.historyIdCounter,
      sql,
      result,
      timestamp: new Date(),
    });
    // Keep only last 100 entries
    if (this.localHistory.length > 100) {
      this.localHistory = this.localHistory.slice(0, 100);
    }

    // Optionally log to PostgreSQL
    if (!ENABLE_PG_LOGGING) return;

    try {
      const db = await getDb();
      if (!db) return;

      const { queryHistory, agentLogs, performanceMetrics } = await import("@/db/schema");

      // Log query
      const [inserted] = await db
        .insert(queryHistory)
        .values({
          queryText: sql,
          queryType: result.queryType,
          status: result.success ? "success" : "error",
          resultData: result.data as Record<string, unknown>,
          errorMessage: result.error || null,
          executionTimeMs: result.executionTimeMs,
          agentPipeline: result.pipeline as unknown as Record<string, unknown>,
        })
        .returning();

      // Log individual agent activities
      for (const agent of result.pipeline) {
        await db.insert(agentLogs).values({
          queryId: inserted.id,
          agentName: agent.agentName,
          action: agent.message,
          input: null,
          output: agent.data as Record<string, unknown>,
          durationMs: agent.durationMs,
          status: agent.status,
          confidence: agent.confidence,
        });
      }

      // Log performance metrics for ML learning
      if (result.success) {
        const plannerResult = result.pipeline.find((a) => a.agentName === "Planner Agent");
        if (plannerResult) {
          const planData = plannerResult.data as { estimatedCost?: number; steps?: Array<{ estimatedRows?: number }> };
          await db.insert(performanceMetrics).values({
            queryPattern: `${result.queryType}`,
            estimatedCost: planData.estimatedCost ?? 0,
            actualCost: result.executionTimeMs,
            rowsEstimated: planData.steps?.[0]?.estimatedRows ?? 0,
            rowsActual: result.rowCount ?? 0,
            planUsed: planData as Record<string, unknown>,
          });
        }
      }
    } catch (e) {
      // Silently fail — logging should never break the query
      if (DEBUG_ORCHESTRATOR) {
        console.error("[Orchestrator] Failed to log to PostgreSQL:", e);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG & INSPECTION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  getOptimizerStats() {
    return this.optimizer.getStats();
  }

  /** Get local query history (works without PostgreSQL) */
  getLocalHistory(limit = 50) {
    return this.localHistory.slice(0, limit).map((h) => ({
      id: h.id,
      queryText: h.sql,
      queryType: h.result.queryType,
      status: h.result.success ? "success" : "error",
      executionTimeMs: h.result.executionTimeMs,
      errorMessage: h.result.error,
      createdAt: h.timestamp.toISOString(),
    }));
  }

  /** Get debug snapshot of all agents */
  getDebugSnapshot() {
    return {
      history: this.localHistory.slice(0, 10),
      optimizerStats: this.optimizer.getStats(),
      pgLoggingEnabled: ENABLE_PG_LOGGING,
      debugMode: DEBUG_ORCHESTRATOR,
    };
  }
}

// Singleton
let orchestratorInstance: Orchestrator | null = null;
export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}
