/**
 * Buffer Manager — In-memory cache of pages using an LRU eviction policy.
 *
 * Reading a page from disk for every operation is slow. The buffer pool keeps
 * recently/frequently used pages in memory and evicts the least-recently-used
 * one when it needs room. This is exactly how PostgreSQL's shared_buffers and
 * MySQL's InnoDB buffer pool work.
 */

import type { RawPage } from "./storage";
import { StorageManager } from "./storage";

interface BufferFrame {
  tableId: number;
  pageId: number;
  page: RawPage;
  pinned: boolean; // pinned pages are never evicted (e.g. during a write txn)
  dirty: boolean; // dirty pages must be flushed to disk before eviction
  lastUsed: number;
}

const MAX_FRAMES = 64; // small pool for the "mini" engine

export class BufferPool {
  private frames = new Map<string, BufferFrame>(); // key = `t{tableId}:p{pageId}`
  private accessCounter = 0;
  private storage: StorageManager;

  private static instance: BufferPool | null = null;

  private constructor(storage: StorageManager) {
    this.storage = storage;
  }

  static getInstance(storage?: StorageManager): BufferPool {
    if (!BufferPool.instance) {
      BufferPool.instance = new BufferPool(
        storage ?? new StorageManager()
      );
    }
    return BufferPool.instance;
  }

  private key(tableId: number, pageId: number): string {
    return `t${tableId}:p${pageId}`;
  }

  /** Fetch a page into the buffer (reading from disk if not present). */
  async pinPage(tableId: number, pageId: number): Promise<BufferFrame> {
    const k = this.key(tableId, pageId);
    const existing = this.frames.get(k);
    if (existing) {
      existing.lastUsed = ++this.accessCounter;
      existing.pinned = true;
      return existing;
    }

    // Not in buffer — load from disk
    const page = await this.storage.readPage(tableId, pageId);
    if (!page) {
      throw new Error(`Page ${pageId} not found for table ${tableId}`);
    }

    // Evict if full
    if (this.frames.size >= MAX_FRAMES) {
      this.evictLRU();
    }

    const frame: BufferFrame = {
      tableId,
      pageId,
      page,
      pinned: true,
      dirty: false,
      lastUsed: ++this.accessCounter,
    };
    this.frames.set(k, frame);
    return frame;
  }

  /** Mark a page dirty and unpin it (call after modifying a page). */
  unpinPage(tableId: number, pageId: number, dirty = false): void {
    const frame = this.frames.get(this.key(tableId, pageId));
    if (frame) {
      frame.pinned = false;
      if (dirty) frame.dirty = true;
    }
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    for (const [k, frame] of this.frames) {
      if (!frame.pinned && frame.lastUsed < lruTime) {
        lruTime = frame.lastUsed;
        lruKey = k;
      }
    }
    if (!lruKey) return; // all pinned — skip eviction

    const frame = this.frames.get(lruKey)!;
    if (frame.dirty) {
      // Synchronously flush — in real engines this is async via a flush list
      // but for correctness in a request/response cycle we await it.
      this.flushFrame(frame);
    }
    this.frames.delete(lruKey);
  }

  private async flushFrame(frame: BufferFrame): Promise<void> {
    await this.storage.writePage(frame.page);
    frame.dirty = false;
  }

  /** Flush all dirty pages to disk (called on commit / shutdown). */
  async flushAll(): Promise<void> {
    for (const frame of this.frames.values()) {
      if (frame.dirty) await this.flushFrame(frame);
    }
  }

  /** Drop all cached pages for a table (after DROP TABLE). */
  invalidateTable(tableId: number): void {
    for (const [k, frame] of this.frames) {
      if (frame.tableId === tableId) {
        this.frames.delete(k);
      }
    }
  }

  get stats() {
    return {
      frames: this.frames.size,
      maxFrames: MAX_FRAMES,
      hitRate: this.hitCount / Math.max(1, this.accessCount),
      accessCount: this.accessCount,
      hitCount: this.hitCount,
    };
  }

  private accessCount = 0;
  private hitCount = 0;

  recordAccess(hit: boolean) {
    this.accessCount++;
    if (hit) this.hitCount++;
  }
}
