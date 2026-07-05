/**
 * ByteDB Engine — the public API of the mini database engine.
 *
 * This is the layer the multi-agent system talks to. It exposes high-level
 * operations (createTable, insert, select, update, delete, listTables, stats)
 * that are implemented on top of the Storage Manager (page store), Buffer Pool
 * (LRU caching), B-Tree indexes, and Table Catalog.
 */

import { TableManager } from "./table";
import { BufferPool } from "./buffer";
import type { ColumnDef } from "../types";

export interface EngineStats {
  tables: number;
  totalRows: number;
  bufferHitRate: number;
  bufferFrames: number;
  bufferAccesses: number;
  indexesLoaded: number;
}

export class ByteDBEngine {
  private tables = new TableManager();
  private buffer = BufferPool.getInstance();

  async createTable(name: string, schema: ColumnDef[]): Promise<number> {
    return this.tables.createTable(name, schema);
  }

  async dropTable(name: string): Promise<void> {
    return this.tables.dropTable(name);
  }

  async insert(name: string, rows: Record<string, unknown>[]): Promise<{ inserted: number }> {
    return this.tables.insert(name, rows);
  }

  async select(
    name: string,
    conditions: Array<{ column: string; operator: string; value: unknown }> = [],
    columns: string[] = ["*"],
    orderBy?: { column: string; direction: "ASC" | "DESC" },
    limit?: number
  ): Promise<Record<string, unknown>[]> {
    // Fast path: equality on an indexed (primary/unique) column uses the B-Tree.
    if (conditions.length === 1 && conditions[0].operator === "=") {
      const viaIndex = await this.tables.selectByIndex(name, conditions[0].column, conditions[0].value);
      if (viaIndex) {
        let rows = viaIndex;
        if (orderBy) {
          const col = orderBy.column;
          rows = rows.sort((a, b) => {
            const cmp = (a[col] as number) < (b[col] as number) ? -1 : 1;
            return orderBy.direction === "DESC" ? -cmp : cmp;
          });
        }
        if (limit !== undefined) rows = rows.slice(0, limit);
        if (!columns.includes("*")) {
          rows = rows.map((r) => {
            const out: Record<string, unknown> = {};
            for (const c of columns) out[c] = r[c];
            return out;
          });
        }
        return rows;
      }
    }
    return this.tables.select(name, conditions, columns, orderBy, limit);
  }

  async update(
    name: string,
    updates: Record<string, unknown>,
    conditions: Array<{ column: string; operator: string; value: unknown }> = []
  ): Promise<number> {
    return this.tables.update(name, updates, conditions);
  }

  async delete(
    name: string,
    conditions: Array<{ column: string; operator: string; value: unknown }> = []
  ): Promise<number> {
    return this.tables.delete(name, conditions);
  }

  async listTables(): Promise<
    Array<{ tableId: number; name: string; schema: ColumnDef[]; rowCount: number; createdAt: string }>
  > {
    return this.tables.listTables();
  }

  async getStats(name: string): Promise<{ rowCount: number; pages: number; hasIndex: boolean }> {
    return this.tables.getStats(name);
  }

  async engineStats(): Promise<EngineStats> {
    const tbls = await this.tables.listTables();
    const bufferStats = this.buffer.stats;
    return {
      tables: tbls.length,
      totalRows: tbls.reduce((s, t) => s + t.rowCount, 0),
      bufferHitRate: bufferStats.hitRate,
      bufferFrames: bufferStats.frames,
      bufferAccesses: bufferStats.accessCount,
      indexesLoaded: tbls.reduce((s, t) => s + (t.primaryKey ? 1 : 0), 0),
    };
  }
}

// Singleton instance shared across requests (kept in-memory process state).
let engineInstance: ByteDBEngine | null = null;
export function getEngine(): ByteDBEngine {
  if (!engineInstance) {
    engineInstance = new ByteDBEngine();
  }
  return engineInstance;
}
