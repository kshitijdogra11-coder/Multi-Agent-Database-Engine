// Executor Agent: Runs the physical plan against the ByteDB engine.
// This demonstrates a real storage engine (pages, B-Tree indexes, buffer pool)
// built from scratch rather than delegating to PostgreSQL.
import { getEngine } from "../core/engine";
import type { ParsedQuery, QueryPlan } from "../types";

export class ExecutorAgent {
  readonly name = "Executor Agent";

  async execute(query: ParsedQuery, plan: QueryPlan): Promise<{ data: unknown; rowCount: number }> {
    const engine = getEngine();

    switch (query.type) {
      case "CREATE_TABLE":
        return this.executeCreateTable(engine, query);
      case "DROP_TABLE":
        return this.executeDropTable(engine, query);
      case "INSERT":
        return this.executeInsert(engine, query);
      case "SELECT":
        return this.executeSelect(engine, query);
      case "UPDATE":
        return this.executeUpdate(engine, query);
      case "DELETE":
        return this.executeDelete(engine, query);
      case "SHOW_TABLES":
        return this.executeShowTables(engine);
      case "DESCRIBE":
        return this.executeDescribe(engine, query);
      default:
        throw new Error(`Unsupported operation: ${query.type}`);
    }
  }

  private async executeCreateTable(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table || !query.schema) throw new Error("Table name and schema required");
    const tableId = await engine.createTable(query.table, query.schema);
    return {
      data: { message: `Table '${query.table}' created (id=${tableId})`, tableId },
      rowCount: 0,
    };
  }

  private async executeDropTable(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table) throw new Error("Table name required");
    await engine.dropTable(query.table);
    return { data: { message: `Table '${query.table}' dropped` }, rowCount: 0 };
  }

  private async executeInsert(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table || !query.values) throw new Error("Table name and values required");
    const { inserted } = await engine.insert(query.table, query.values);
    return {
      data: { message: `Inserted ${inserted} row(s) into '${query.table}'` },
      rowCount: inserted,
    };
  }

  private async executeSelect(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table) throw new Error("Table name required");
    const rows = await engine.select(
      query.table,
      query.conditions ?? [],
      query.columns ?? ["*"],
      query.orderBy,
      query.limit
    );
    return { data: rows, rowCount: rows.length };
  }

  private async executeUpdate(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table || !query.updates) throw new Error("Table name and updates required");
    const count = await engine.update(query.table, query.updates, query.conditions ?? []);
    return { data: { message: `Updated ${count} row(s)` }, rowCount: count };
  }

  private async executeDelete(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table) throw new Error("Table name required");
    const count = await engine.delete(query.table, query.conditions ?? []);
    return { data: { message: `Deleted ${count} row(s)` }, rowCount: count };
  }

  private async executeShowTables(engine: ReturnType<typeof getEngine>) {
    const tables = await engine.listTables();
    return {
      data: tables.map((t) => ({
        name: t.name,
        columns: t.schema.length,
        rows: t.rowCount,
        createdAt: t.createdAt,
      })),
      rowCount: tables.length,
    };
  }

  private async executeDescribe(engine: ReturnType<typeof getEngine>, query: ParsedQuery) {
    if (!query.table) throw new Error("Table name required");
    const tables = await engine.listTables();
    const table = tables.find((t) => t.name.toLowerCase() === query.table!.toLowerCase());
    if (!table) throw new Error(`Table '${query.table}' does not exist`);
    return {
      data: {
        tableName: table.name,
        columns: table.schema,
        rowCount: table.rowCount,
        createdAt: table.createdAt,
      },
      rowCount: table.schema.length,
    };
  }

  async getTableStats(tableName: string): Promise<{ rowCount: number; hasIndex: boolean }> {
    try {
      const engine = getEngine();
      const stats = await engine.getStats(tableName);
      return { rowCount: stats.rowCount, hasIndex: stats.hasIndex };
    } catch {
      return { rowCount: 0, hasIndex: false };
    }
  }
}
