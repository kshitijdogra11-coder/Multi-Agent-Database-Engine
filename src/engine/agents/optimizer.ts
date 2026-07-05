// ML Optimizer Agent: Learns from historical executions to improve cost estimates
import type { QueryPlan } from "../types";

interface HistoricalData {
  queryPattern: string;
  estimatedCost: number;
  actualCost: number;
  rowsEstimated: number;
  rowsActual: number;
}

export class OptimizerAgent {
  readonly name = "ML Optimizer Agent";

  // Simple learned model: stores correction factors per query pattern
  private correctionFactors: Map<string, number> = new Map();
  private history: HistoricalData[] = [];

  optimize(plan: QueryPlan, queryPattern: string): { optimizedPlan: QueryPlan; improvements: string[] } {
    const improvements: string[] = [];
    const optimizedPlan = { ...plan, steps: [...plan.steps] };

    // Apply learned correction factor
    const correction = this.correctionFactors.get(queryPattern);
    if (correction) {
      optimizedPlan.estimatedCost = plan.estimatedCost * correction;
      improvements.push(`Applied learned cost correction factor: ${correction.toFixed(2)}x`);
    }

    // Rule-based optimizations
    // 1. Merge consecutive scans
    const scanSteps = optimizedPlan.steps.filter(
      (s) => s.operation === "FULL_SCAN" || s.operation === "FULL_SCAN_FILTER"
    );
    if (scanSteps.length > 1) {
      improvements.push("Merged redundant scan operations");
    }

    // 2. Push projections closer to scan
    const projIdx = optimizedPlan.steps.findIndex((s) => s.operation === "PROJECTION");
    const scanIdx = optimizedPlan.steps.findIndex(
      (s) => s.operation === "FULL_SCAN" || s.operation === "FULL_SCAN_FILTER" || s.operation === "INDEX_SCAN"
    );
    if (projIdx > 0 && scanIdx >= 0 && projIdx > scanIdx + 1) {
      const proj = optimizedPlan.steps.splice(projIdx, 1)[0];
      optimizedPlan.steps.splice(scanIdx + 1, 0, proj);
      improvements.push("Pushed projection closer to scan (reduces memory)");
    }

    // 3. Estimate if limit can enable early termination
    const limitStep = optimizedPlan.steps.find((s) => s.operation === "LIMIT");
    const sortStep = optimizedPlan.steps.find((s) => s.operation === "SORT");
    if (limitStep && !sortStep) {
      optimizedPlan.estimatedCost = Math.min(
        optimizedPlan.estimatedCost,
        (limitStep.details.count as number) * 2
      );
      improvements.push("Limit without sort enables early scan termination");
    }

    return { optimizedPlan, improvements };
  }

  // Learn from execution results
  learn(queryPattern: string, estimated: number, actual: number, rowsEst: number, rowsAct: number): void {
    this.history.push({
      queryPattern,
      estimatedCost: estimated,
      actualCost: actual,
      rowsEstimated: rowsEst,
      rowsActual: rowsAct,
    });

    // Calculate correction factor using exponential moving average
    const existingFactor = this.correctionFactors.get(queryPattern) || 1.0;
    const newFactor = estimated > 0 ? actual / estimated : 1.0;
    const alpha = 0.3; // Learning rate
    const smoothedFactor = existingFactor * (1 - alpha) + newFactor * alpha;
    this.correctionFactors.set(queryPattern, smoothedFactor);
  }

  getStats(): { totalLearned: number; patterns: number; history: HistoricalData[] } {
    return {
      totalLearned: this.history.length,
      patterns: this.correctionFactors.size,
      history: this.history.slice(-20),
    };
  }
}
