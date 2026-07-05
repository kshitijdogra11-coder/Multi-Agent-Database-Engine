/**
 * Table & Catalog Manager.
 *
 * Manages table definitions (schema), per-table indexes (B-Trees), and the
 * CRUD operations against the storage engine. Enforces constraints
 * (NOT NULL, UNIQUE, PRIMARY KEY) at write time.
 */

import { promises as fs } from "fs";
import path from "path";
import { StorageManager } from "./storage";
import { BufferPool } from "./buffer";
import { BTreeIndex } from "./btree";
import type { BTreeNodeData, BTreeMeta } from "./btree";
import fsSync from "fs";
import type { ColumnDef } from "../types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".dbdata");
const CATALOG_FILE = path.join(DATA_DIR, "bytdb.catalog.json");
const INDEX_DIR = path.join(DATA_DIR, "indexes");

interface TableCatalogEntry {
  tableId: number;
  name: string;
  schema: ColumnDef[];
  primaryKey: string | null;
  uniqueColumns: string[];
  notNullColumns: string[];
  createdAt: string;
  rowCount: number;
}

interface PageSlot {
  pageId: number;
  slot: number; // index within page.records
}

export interface ConstraintViolation extends Error {}

let catalogCache: TableCatalogEntry[] | null = null;

export class TableManager {
  private storage = new StorageManager();
  private buffer = BufferPool.getInstance();
  private indexes = new Map<string, BTreeIndex>(); // key = `${tableId}:${column}`

  // ── Catalog persistence ──
  private async loadCatalog(): Promise<TableCatalogEntry[]> {
    if (catalogCache) return catalogCache;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(CATALOG_FILE, "utf-8");
      catalogCache = JSON.parse(raw);
    } catch {
      catalogCache = [];
    }
    return catalogCache!;
  }

  private async saveCatalog(cat: TableCatalogEntry[]): Promise<void> {
    catalogCache = cat;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CATALOG_FILE, JSON.stringify(cat), "utf-8");
  }

  private async getEntry(name: string): Promise<TableCatalogEntry> {
    const cat = await this.loadCatalog();
    const entry = cat.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (!entry) throw new ConstraintViolationImpl(`Table '${name}' does not exist`);
    return entry;
  }

  private async getEntryById(tableId: number): Promise<TableCatalogEntry> {
    const cat = await this.loadCatalog();
    const entry = cat.find((e) => e.tableId === tableId);
    if (!entry) throw new ConstraintViolationImpl(`Table id ${tableId} not found`);
    return entry;
  }

  // ── Index persistence helpers ──
  private indexKey(tableId: number, column: string): string {
    return `${tableId}:${column}`;
  }

  private async loadIndex(entry: TableCatalogEntry, column: string): Promise<BTreeIndex> {
    const key = this.indexKey(entry.tableId, column);
    const existing = this.indexes.get(key);
    if (existing) return existing;

    const idxPath = path.join(INDEX_DIR, `${entry.tableId}_${column}.json`);

    // Load all nodes into memory at once (atomic read from disk).
    const loadAll = (): { meta: BTreeMeta | null; nodes: BTreeNodeData[] } => {
      try {
        return this.readIndexFile(idxPath);
      } catch {
        return { meta: null, nodes: [] };
      }
    };

    // Write the COMPLETE index state to disk atomically.
    const persistAll = (meta: BTreeMeta, nodes: Map<number, BTreeNodeData>): void => {
      try {
        const arr = Array.from(nodes.values());
        fsSync.writeFileSync(idxPath, JSON.stringify({ meta, nodes: arr }));
      } catch {
        // ignore
      }
    };

    const initial = loadAll();

    // Deferred reference so the constructor's internal persistMeta call works.
    let btreeRef: BTreeIndex | null = null;
    const btree = new BTreeIndex(
      () => initial.meta,
      (m) => persistAll(m, btreeRef?.getNodes() ?? new Map()),
      (id) => {
        const found = initial.nodes.find((n) => n.nodeId === id);
        return found ?? null;
      },
      () => {
        // Nodes are kept in-memory in the BTreeIndex; persisted via meta callback.
      }
    );
    btreeRef = btree;

    // Seed the B-Tree's in-memory node cache from disk.
    if (initial.nodes.length > 0) {
      for (const n of initial.nodes) btree.seedNode(n);
    }

    // Flush the current state so disk stays in sync.
    btree.sync();

    this.indexes.set(key, btree);
    return btree;
  }

  private readIndexFile(p: string): { meta: BTreeMeta | null; nodes: BTreeNodeData[] } {
    try {
      const parsed = JSON.parse(fsSync.readFileSync(p, "utf-8"));
      return { meta: (parsed.meta as BTreeMeta) ?? null, nodes: (parsed.nodes as BTreeNodeData[]) ?? [] };
    } catch {
      return { meta: null, nodes: [] };
    }
  }

  get openIndexes(): number {
    return this.indexes.size;
  }

  // ── Table DDL ──
  async createTable(name: string, schema: ColumnDef[]): Promise<number> {
    const cat = await this.loadCatalog();
    if (cat.find((e) => e.name.toLowerCase() === name.toLowerCase())) {
      throw new ConstraintViolationImpl(`Table '${name}' already exists`);
    }

    const tableId = cat.length;
    const primaryKeyCol = schema.find((c) => c.primaryKey)?.name ?? null;
    const uniqueCols = schema.filter((c) => c.primaryKey).map((c) => c.name); // PK implies unique
    const notNullCols = schema.filter((c) => c.nullable === false).map((c) => c.name);

    const entry: TableCatalogEntry = {
      tableId,
      name,
      schema,
      primaryKey: primaryKeyCol,
      uniqueColumns: uniqueCols,
      notNullColumns: notNullCols,
      createdAt: new Date().toISOString(),
      rowCount: 0,
    };
    cat.push(entry);
    await this.saveCatalog(cat);

    // Allocate the first page for the table
    await this.storage.allocatePage(tableId);

    // Build index on primary key (if any) for fast lookups
    if (primaryKeyCol) {
      await this.loadIndex(entry, primaryKeyCol);
    }

    return tableId;
  }

  async dropTable(name: string): Promise<void> {
    const entry = await this.getEntry(name);
    await this.storage.deleteTable(entry.tableId);
    const cat = await this.loadCatalog();
    catalogCache = cat.filter((e) => e.tableId !== entry.tableId);
    await this.saveCatalog(catalogCache);
    // Remove index files
    try {
      const files = await fs.readdir(INDEX_DIR);
      for (const f of files) {
        if (f.startsWith(`${entry.tableId}_`)) {
          await fs.unlink(path.join(INDEX_DIR, f));
        }
      }
    } catch {
      // ignore
    }
  }

  async listTables(): Promise<TableCatalogEntry[]> {
    return this.loadCatalog();
  }

  // ── Constraint helpers ──
  private validateRow(entry: TableCatalogEntry, row: Record<string, unknown>): void {
    for (const col of entry.schema) {
      const val = row[col.name];
      if (val === undefined || val === null) {
        if (entry.notNullColumns.includes(col.name)) {
          throw new ConstraintViolationImpl(
            `NOT NULL constraint violated on column '${col.name}'`
          );
        }
        continue;
      }
      // Type check
      this.assertType(col, val);
    }
  }

  private assertType(col: ColumnDef, val: unknown): void {
    switch (col.type) {
      case "INTEGER":
        if (typeof val !== "number" || !Number.isInteger(val)) {
          throw new ConstraintViolationImpl(
            `Type mismatch: column '${col.name}' expects INTEGER, got ${typeof val}`
          );
        }
        break;
      case "REAL":
        if (typeof val !== "number") {
          throw new ConstraintViolationImpl(
            `Type mismatch: column '${col.name}' expects REAL, got ${typeof val}`
          );
        }
        break;
      case "BOOLEAN":
        if (typeof val !== "boolean") {
          throw new ConstraintViolationImpl(
            `Type mismatch: column '${col.name}' expects BOOLEAN, got ${typeof val}`
          );
        }
        break;
      case "TEXT":
        if (typeof val !== "string") {
          throw new ConstraintViolationImpl(
            `Type mismatch: column '${col.name}' expects TEXT, got ${typeof val}`
          );
        }
        break;
    }
  }

  // ── CRUD ──
  async insert(
    name: string,
    rows: Record<string, unknown>[]
  ): Promise<{ inserted: number }> {
    const entry = await this.getEntry(name);

    for (const row of rows) {
      this.validateRow(entry, row);
    }

    // Enforce UNIQUE / PRIMARY KEY constraints by scanning existing rows once.
    for (const row of rows) {
      await this.enforceUnique(entry, row, -1);
    }

    for (const row of rows) {
      // Allocate a slot on a page (simple append strategy)
      const pageIds = await this.storage.getPagesForTable(entry.tableId);
      let targetPage = pageIds[pageIds.length - 1];
      let frame = await this.buffer.pinPage(entry.tableId, targetPage);

      // Find a free slot index
      const slot = frame.page.records.length;
      frame.page.records.push({ id: this.nextRecordId(entry), data: row });
      frame.page.header.recordCount = frame.page.records.length;
      this.buffer.unpinPage(entry.tableId, targetPage, true);

      // Update indexes
      for (const col of entry.schema) {
        if (entry.uniqueColumns.includes(col.name) || entry.primaryKey === col.name) {
          const idx = await this.loadIndex(entry, col.name);
          idx.insert(row[col.name], [targetPage, slot]);
        }
      }
    }

    entry.rowCount += rows.length;
    const cat = await this.loadCatalog();
    const idx = cat.findIndex((e) => e.tableId === entry.tableId);
    cat[idx] = entry;
    await this.saveCatalog(cat);

    await this.buffer.flushAll();
    return { inserted: rows.length };
  }

  private nextRecordId(entry: TableCatalogEntry): number {
    return entry.rowCount; // simple monotonic id
  }

  private async enforceUnique(
    entry: TableCatalogEntry,
    row: Record<string, unknown>,
    excludeSlot: number
  ): Promise<void> {
    if (!entry.primaryKey) return;
    const idx = await this.loadIndex(entry, entry.primaryKey);
    const existing = idx.search(row[entry.primaryKey]);
    if (existing && existing[1] !== excludeSlot) {
      throw new ConstraintViolationImpl(
        `UNIQUE/PRIMARY KEY constraint violated on '${entry.primaryKey}' = ${row[entry.primaryKey]}`
      );
    }
  }

  async select(
    name: string,
    conditions: Array<{ column: string; operator: string; value: unknown }>,
    columns: string[] = ["*"],
    orderBy?: { column: string; direction: "ASC" | "DESC" },
    limit?: number
  ): Promise<Record<string, unknown>[]> {
    const entry = await this.getEntry(name);
    let rows = await this.readAllRows(entry);

    // Apply conditions
    if (conditions.length > 0) {
      rows = rows.filter((r) =>
        conditions.every((c) => this.matchCondition(r, c))
      );
    }

    // Ordering
    if (orderBy) {
      const col = orderBy.column;
      rows.sort((a, b) => {
        const va = a[col];
        const vb = b[col];
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        const cmp = va < vb ? -1 : 1;
        return orderBy.direction === "DESC" ? -cmp : cmp;
      });
    }

    if (limit !== undefined) rows = rows.slice(0, limit);

    // Projection
    if (!columns.includes("*")) {
      rows = rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const c of columns) out[c] = r[c];
        return out;
      });
    }

    return rows;
  }

  /** Demonstrates index usage: if a condition is on the primary/unique key,
   *  use the B-Tree instead of a full scan. */
  async selectByIndex(
    name: string,
    keyColumn: string,
    keyValue: unknown
  ): Promise<Record<string, unknown>[] | null> {
    const entry = await this.getEntry(name);
    if (!entry.uniqueColumns.includes(keyColumn) && entry.primaryKey !== keyColumn) {
      return null; // no index on this column
    }
    const idx = await this.loadIndex(entry, keyColumn);
    const loc = idx.search(keyValue);
    if (!loc) return null;
    return [await this.readRowAt(entry, loc[0], loc[1])];
  }

  async update(
    name: string,
    updates: Record<string, unknown>,
    conditions: Array<{ column: string; operator: string; value: unknown }>
  ): Promise<number> {
    const entry = await this.getEntry(name);
    const rows = await this.readAllRows(entry);
    let count = 0;

    for (let i = 0; i < rows.length; i++) {
      if (conditions.length === 0 || conditions.every((c) => this.matchCondition(rows[i], c))) {
        const merged = { ...rows[i], ...updates };
        this.validateRow(entry, merged);

        // Re-index updated key columns
        const oldRow = rows[i];
        for (const col of entry.schema) {
          if (
            (entry.uniqueColumns.includes(col.name) || entry.primaryKey === col.name) &&
            updates[col.name] !== undefined
          ) {
            const idx = await this.loadIndex(entry, col.name);
            // remove old
            idx.remove(oldRow[col.name]);
          }
        }

        // Write merged row back to its page/slot
        await this.writeRowBack(entry, i, merged);

        for (const col of entry.schema) {
          if (
            (entry.uniqueColumns.includes(col.name) || entry.primaryKey === col.name) &&
            updates[col.name] !== undefined
          ) {
            const idx = await this.loadIndex(entry, col.name);
            const loc = await this.locateRow(entry, i);
            idx.insert(merged[col.name], loc);
          }
        }
        count++;
      }
    }
    await this.buffer.flushAll();
    return count;
  }

  async delete(
    name: string,
    conditions: Array<{ column: string; operator: string; value: unknown }>
  ): Promise<number> {
    const entry = await this.getEntry(name);
    const rows = await this.readAllRows(entry);
    let count = 0;

    for (let i = rows.length - 1; i >= 0; i--) {
      if (conditions.length === 0 || conditions.every((c) => this.matchCondition(rows[i], c))) {
        // Remove from indexes
        for (const col of entry.schema) {
          if (entry.uniqueColumns.includes(col.name) || entry.primaryKey === col.name) {
            const idx = await this.loadIndex(entry, col.name);
            idx.remove(rows[i][col.name]);
          }
        }
        await this.markRowDeleted(entry, i);
        count++;
      }
    }

    entry.rowCount = Math.max(0, entry.rowCount - count);
    const cat = await this.loadCatalog();
    const ci = cat.findIndex((e) => e.tableId === entry.tableId);
    cat[ci] = entry;
    await this.saveCatalog(cat);

    await this.buffer.flushAll();
    return count;
  }

  // ── Low-level row access ──
  private async readAllRows(entry: TableCatalogEntry): Promise<Record<string, unknown>[]> {
    const pageIds = await this.storage.getPagesForTable(entry.tableId);
    const out: Record<string, unknown>[] = [];
    for (const pageId of pageIds) {
      const frame = await this.buffer.pinPage(entry.tableId, pageId);
      for (const rec of frame.page.records) {
        if ((rec as { deleted?: boolean }).deleted) continue;
        out.push(rec.data);
      }
      this.buffer.unpinPage(entry.tableId, pageId, false);
    }
    return out;
  }

  private async readRowAt(
    entry: TableCatalogEntry,
    pageId: number,
    slot: number
  ): Promise<Record<string, unknown>> {
    const frame = await this.buffer.pinPage(entry.tableId, pageId);
    const rec = frame.page.records[slot];
    this.buffer.unpinPage(entry.tableId, pageId, false);
    return rec.data;
  }

  private async locateRow(entry: TableCatalogEntry, rowIndex: number): Promise<number[]> {
    const pageIds = await this.storage.getPagesForTable(entry.tableId);
    let counter = -1;
    for (const pageId of pageIds) {
      const frame = await this.buffer.pinPage(entry.tableId, pageId);
      for (let slot = 0; slot < frame.page.records.length; slot++) {
        if ((frame.page.records[slot] as { deleted?: boolean }).deleted) continue;
        counter++;
        if (counter === rowIndex) {
          this.buffer.unpinPage(entry.tableId, pageId, false);
          return [pageId, slot];
        }
      }
      this.buffer.unpinPage(entry.tableId, pageId, false);
    }
    return [-1, -1];
  }

  private async writeRowBack(
    entry: TableCatalogEntry,
    rowIndex: number,
    data: Record<string, unknown>
  ): Promise<void> {
    const [pageId, slot] = await this.locateRow(entry, rowIndex);
    if (pageId < 0) return;
    const frame = await this.buffer.pinPage(entry.tableId, pageId);
    frame.page.records[slot] = { id: slot, data };
    this.buffer.unpinPage(entry.tableId, pageId, true);
  }

  private async markRowDeleted(entry: TableCatalogEntry, rowIndex: number): Promise<void> {
    const [pageId, slot] = await this.locateRow(entry, rowIndex);
    if (pageId < 0) return;
    const frame = await this.buffer.pinPage(entry.tableId, pageId);
    (frame.page.records[slot] as { deleted?: boolean }).deleted = true;
    this.buffer.unpinPage(entry.tableId, pageId, true);
  }

  private matchCondition(
    row: Record<string, unknown>,
    cond: { column: string; operator: string; value: unknown }
  ): boolean {
    const val = row[cond.column];
    switch (cond.operator) {
      case "=":
        return val == cond.value;
      case "!=":
        return val != cond.value;
      case ">":
        return (val as number) > (cond.value as number);
      case "<":
        return (val as number) < (cond.value as number);
      case ">=":
        return (val as number) >= (cond.value as number);
      case "<=":
        return (val as number) <= (cond.value as number);
      case "LIKE": {
        const pattern = String(cond.value)
          .replace(/%/g, ".*")
          .replace(/_/g, ".");
        return new RegExp(`^${pattern}$`, "i").test(String(val));
      }
      default:
        return false;
    }
  }

  /** Stats useful for the planner: row count, page count, open indexes. */
  async getStats(name: string): Promise<{ rowCount: number; pages: number; hasIndex: boolean }> {
    const entry = await this.getEntry(name);
    const pages = await this.storage.pageCount(entry.tableId);
    return {
      rowCount: entry.rowCount,
      pages,
      hasIndex: entry.primaryKey !== null,
    };
  }
}

class ConstraintViolationImpl extends Error implements ConstraintViolation {
  constructor(message: string) {
    super(message);
    this.name = "ConstraintViolation";
  }
}
