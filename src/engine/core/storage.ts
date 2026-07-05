/**
 * Storage Manager — Page-based file storage.
 *
 * Data is stored in fixed-size pages on disk. Each page holds a set of records
 * (rows) serialized as JSON. Pages are addressed by pageId. This mimics how
 * real DBMS engines (PostgreSQL, MySQL/InnoDB) organize data into pages/blocks.
 */

export const PAGE_SIZE = 4096; // bytes per page (typical DB page is 4KB / 8KB)
const PAGE_MAGIC = 0x4244; // "BD" — ByteDB magic number
const PAGE_VERSION = 1;

export interface PageHeader {
  magic: number;
  version: number;
  pageId: number;
  tableId: number;
  recordCount: number;
  freeSpace: number; // remaining bytes available in the page
  nextPageId: number; // for overflow chains (linked list of pages within a table)
  flags: number;
}

export interface RawPage {
  header: PageHeader;
  records: Array<{ id: number; data: Record<string, unknown> }>;
}

function encodeU32(n: number): string {
  // Use a base36 string of a uint32 — compact and safe
  return n.toString(36).padStart(7, "0");
}

function decodeU32(s: string): number {
  return parseInt(s, 36);
}

/**
 * Minimal durable key/value persistence layer backed by a single JSON file.
 * In a "real" engine this would be a memory-mapped file with pages; here we use
 * a lightweight file-based store so the project runs anywhere (including the
 * serverless preview) without native dependencies.
 */
import { promises as fs } from "fs";
import path from "path";
import { BufferPool } from "./buffer";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".dbdata");
const STORAGE_FILE = path.join(DATA_DIR, "bytdb.pages.json");

type Store = Record<string, RawPage>; // key = `t{tableId}:p{pageId}`

export class StorageManager {
  private store: Store = {};
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(STORAGE_FILE, "utf-8");
      this.store = JSON.parse(raw);
    } catch {
      this.store = {};
    }
    this.loaded = true;
  }

  private async flush(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORAGE_FILE, JSON.stringify(this.store), "utf-8");
  }

  private pageKey(tableId: number, pageId: number): string {
    return `t${tableId}:p${pageId}`;
  }

  /** Allocate a fresh empty page for a table and return its pageId. */
  async allocatePage(tableId: number): Promise<number> {
    await this.ensureLoaded();
    // Find the next free pageId for this table by scanning existing keys.
    let maxId = -1;
    for (const key of Object.keys(this.store)) {
      if (key.startsWith(`t${tableId}:`)) {
        const id = decodeU32(key.split(":p")[1]);
        if (id > maxId) maxId = id;
      }
    }
    const pageId = maxId + 1;
    const page: RawPage = {
      header: {
        magic: PAGE_MAGIC,
        version: PAGE_VERSION,
        pageId,
        tableId,
        recordCount: 0,
        freeSpace: PAGE_SIZE,
        nextPageId: -1,
        flags: 0,
      },
      records: [],
    };
    this.store[this.pageKey(tableId, pageId)] = page;
    await this.flush();
    return pageId;
  }

  /** Get (or lazily create) the list of pageIds belonging to a table. */
  async getPagesForTable(tableId: number): Promise<number[]> {
    await this.ensureLoaded();
    const ids: number[] = [];
    for (const key of Object.keys(this.store)) {
      if (key.startsWith(`t${tableId}:`)) {
        ids.push(decodeU32(key.split(":p")[1]));
      }
    }
    return ids.sort((a, b) => a - b);
  }

  async readPage(tableId: number, pageId: number): Promise<RawPage | null> {
    await this.ensureLoaded();
    return this.store[this.pageKey(tableId, pageId)] ?? null;
  }

  async writePage(page: RawPage): Promise<void> {
    await this.ensureLoaded();
    // Recompute header stats
    const serialized = JSON.stringify(page.records);
    page.header.recordCount = page.records.length;
    page.header.freeSpace = PAGE_SIZE - serialized.length;
    this.store[this.pageKey(page.header.tableId, page.header.pageId)] = page;
    await this.flush();
  }

  async deleteTable(tableId: number): Promise<void> {
    await this.ensureLoaded();
    for (const key of Object.keys(this.store)) {
      if (key.startsWith(`t${tableId}:`)) {
        delete this.store[key];
      }
    }
    // Also clear any cached pages for the table in the buffer pool
    BufferPool.getInstance().invalidateTable(tableId);
    await this.flush();
  }

  /** Count total pages for a table (for statistics). */
  async pageCount(tableId: number): Promise<number> {
    return (await this.getPagesForTable(tableId)).length;
  }
}

export { encodeU32, decodeU32 };
