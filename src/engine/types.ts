// Core types for the multi-agent mini database engine

export type QueryType = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "CREATE_TABLE" | "DROP_TABLE" | "SHOW_TABLES" | "DESCRIBE" | "UNKNOWN";

export interface ParsedQuery {
  type: QueryType;
  table?: string;
  columns?: string[];
  values?: Record<string, unknown>[];
  conditions?: Condition[];
  updates?: Record<string, unknown>;
  schema?: ColumnDef[];
  limit?: number;
  orderBy?: { column: string; direction: "ASC" | "DESC" };
  raw: string;
}

export interface Condition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE";
  value: unknown;
}

export interface ColumnDef {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL" | "BOOLEAN";
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: unknown;
}

export interface QueryPlan {
  steps: PlanStep[];
  estimatedCost: number;
  strategy: string;
  optimizations: string[];
}

export interface PlanStep {
  operation: string;
  target?: string;
  details: Record<string, unknown>;
  estimatedRows?: number;
}

export interface AgentResult {
  agentName: string;
  status: "success" | "error" | "warning";
  data: unknown;
  confidence: number;
  durationMs: number;
  message: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  rowCount?: number;
  error?: string;
  pipeline: AgentResult[];
  executionTimeMs: number;
  queryType: QueryType;
}

export interface AgentContext {
  queryId: string;
  retryCount: number;
  maxRetries: number;
  startTime: number;
}
