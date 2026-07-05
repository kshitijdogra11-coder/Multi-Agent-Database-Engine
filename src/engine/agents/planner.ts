// Planner Agent: Creates execution plans with cost estimation
import type { ParsedQuery, QueryPlan, PlanStep } from "../types";

export class PlannerAgent {
  readonly name = "Planner Agent";

  createPlan(query: ParsedQuery, tableStats: { rowCount: number; hasIndex: boolean }): QueryPlan {
    const steps: PlanStep[] = [];
    const optimizations: string[] = [];
    let estimatedCost = 0;

    switch (query.type) {
      case "SELECT":
        return this.planSelect(query, tableStats);
      case "INSERT":
        return this.planInsert(query, tableStats);
      case "UPDATE":
        return this.planUpdate(query, tableStats);
      case "DELETE":
        return this.planDelete(query, tableStats);
      case "CREATE_TABLE":
        steps.push({ operation: "CREATE_TABLE", target: query.table, details: { schema: query.schema }, estimatedRows: 0 });
        return { steps, estimatedCost: 1, strategy: "DDL", optimizations: [] };
      case "DROP_TABLE":
        steps.push({ operation: "DROP_TABLE", target: query.table, details: {}, estimatedRows: 0 });
        return { steps, estimatedCost: 1, strategy: "DDL", optimizations: [] };
      case "SHOW_TABLES":
        steps.push({ operation: "CATALOG_SCAN", details: { type: "list_tables" }, estimatedRows: 10 });
        return { steps, estimatedCost: 1, strategy: "CATALOG", optimizations: [] };
      case "DESCRIBE":
        steps.push({ operation: "CATALOG_SCAN", details: { type: "describe", table: query.table }, estimatedRows: 10 });
        return { steps, estimatedCost: 1, strategy: "CATALOG", optimizations: [] };
      default:
        return { steps: [], estimatedCost: 0, strategy: "UNKNOWN", optimizations: [] };
    }
  }

  private planSelect(query: ParsedQuery, stats: { rowCount: number; hasIndex: boolean }): QueryPlan {
    const steps: PlanStep[] = [];
    const optimizations: string[] = [];
    let estimatedCost = 0;
    const rowCount = stats.rowCount;

    // Step 1: Scan strategy
    if (query.conditions && query.conditions.length > 0 && stats.hasIndex) {
      steps.push({
        operation: "INDEX_SCAN",
        target: query.table,
        details: { conditions: query.conditions, index: "primary" },
        estimatedRows: Math.max(1, Math.floor(rowCount * 0.1)),
      });
      optimizations.push("Using index scan for WHERE clause");
      estimatedCost += rowCount * 0.1;
    } else if (query.conditions && query.conditions.length > 0) {
      steps.push({
        operation: "FULL_SCAN_FILTER",
        target: query.table,
        details: { conditions: query.conditions },
        estimatedRows: Math.max(1, Math.floor(rowCount * 0.3)),
      });
      optimizations.push("Full scan with filter (no suitable index)");
      estimatedCost += rowCount;
    } else {
      steps.push({
        operation: "FULL_SCAN",
        target: query.table,
        details: {},
        estimatedRows: rowCount,
      });
      estimatedCost += rowCount;
    }

    // Step 2: Projection
    if (query.columns && !query.columns.includes("*")) {
      steps.push({
        operation: "PROJECTION",
        details: { columns: query.columns },
        estimatedRows: steps[steps.length - 1]?.estimatedRows || rowCount,
      });
      optimizations.push("Column projection pushdown");
    }

    // Step 3: Sort
    if (query.orderBy) {
      steps.push({
        operation: "SORT",
        details: { column: query.orderBy.column, direction: query.orderBy.direction },
        estimatedRows: steps[steps.length - 1]?.estimatedRows || rowCount,
      });
      estimatedCost += Math.log2(rowCount + 1) * rowCount; // O(n log n)
      optimizations.push(`Sorting by ${query.orderBy.column} ${query.orderBy.direction}`);
    }

    // Step 4: Limit
    if (query.limit) {
      steps.push({
        operation: "LIMIT",
        details: { count: query.limit },
        estimatedRows: Math.min(query.limit, steps[steps.length - 1]?.estimatedRows || rowCount),
      });
      optimizations.push(`Early termination at LIMIT ${query.limit}`);
    }

    return {
      steps,
      estimatedCost: Math.max(1, estimatedCost),
      strategy: "SEQUENTIAL_SCAN",
      optimizations,
    };
  }

  private planInsert(query: ParsedQuery, _stats: { rowCount: number; hasIndex: boolean }): QueryPlan {
    const rowCount = query.values?.length || 1;
    return {
      steps: [
        { operation: "VALIDATE_SCHEMA", target: query.table, details: { rowCount }, estimatedRows: rowCount },
        { operation: "INSERT_ROWS", target: query.table, details: { rowCount }, estimatedRows: rowCount },
        { operation: "UPDATE_STATISTICS", target: query.table, details: {}, estimatedRows: 0 },
      ],
      estimatedCost: rowCount * 2,
      strategy: "BATCH_INSERT",
      optimizations: rowCount > 1 ? ["Batch insert optimization"] : [],
    };
  }

  private planUpdate(query: ParsedQuery, stats: { rowCount: number; hasIndex: boolean }): QueryPlan {
    const hasWhere = query.conditions && query.conditions.length > 0;
    return {
      steps: [
        {
          operation: hasWhere ? "SCAN_FILTER" : "FULL_SCAN",
          target: query.table,
          details: { conditions: query.conditions || [] },
          estimatedRows: hasWhere ? Math.floor(stats.rowCount * 0.3) : stats.rowCount,
        },
        {
          operation: "UPDATE_ROWS",
          target: query.table,
          details: { updates: query.updates },
          estimatedRows: hasWhere ? Math.floor(stats.rowCount * 0.3) : stats.rowCount,
        },
      ],
      estimatedCost: stats.rowCount,
      strategy: "SCAN_AND_UPDATE",
      optimizations: hasWhere ? ["Filtered update"] : [],
    };
  }

  private planDelete(query: ParsedQuery, stats: { rowCount: number; hasIndex: boolean }): QueryPlan {
    const hasWhere = query.conditions && query.conditions.length > 0;
    return {
      steps: [
        {
          operation: hasWhere ? "SCAN_FILTER" : "FULL_SCAN",
          target: query.table,
          details: { conditions: query.conditions || [] },
          estimatedRows: hasWhere ? Math.floor(stats.rowCount * 0.3) : stats.rowCount,
        },
        {
          operation: "DELETE_ROWS",
          target: query.table,
          details: {},
          estimatedRows: hasWhere ? Math.floor(stats.rowCount * 0.3) : stats.rowCount,
        },
      ],
      estimatedCost: stats.rowCount,
      strategy: "SCAN_AND_DELETE",
      optimizations: hasWhere ? ["Filtered delete"] : [],
    };
  }
}
