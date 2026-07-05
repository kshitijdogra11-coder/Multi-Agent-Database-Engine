import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  serial,
  boolean,
  real,
} from "drizzle-orm/pg-core";

// Virtual tables managed by the mini DB engine
export const virtualTables = pgTable("virtual_tables", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  schema: jsonb("schema").notNull(), // column definitions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rowCount: integer("row_count").default(0).notNull(),
});

// Virtual rows stored as JSONB
export const virtualRows = pgTable("virtual_rows", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id")
    .references(() => virtualTables.id)
    .notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
});

// Query execution history
export const queryHistory = pgTable("query_history", {
  id: serial("id").primaryKey(),
  queryText: text("query_text").notNull(),
  queryType: varchar("query_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  resultData: jsonb("result_data"),
  errorMessage: text("error_message"),
  executionTimeMs: real("execution_time_ms"),
  agentPipeline: jsonb("agent_pipeline"), // which agents processed this
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent activity logs
export const agentLogs = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  queryId: integer("query_id"),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  durationMs: real("duration_ms"),
  status: varchar("status", { length: 50 }).notNull(),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Performance metrics for ML optimizer
export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  queryPattern: varchar("query_pattern", { length: 500 }).notNull(),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  rowsEstimated: integer("rows_estimated"),
  rowsActual: integer("rows_actual"),
  planUsed: jsonb("plan_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
