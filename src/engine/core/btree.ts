/**
 * B-Tree Index — self-balancing tree for O(log n) lookups.
 *
 * A B-Tree keeps keys sorted and balanced, so search, insert, and delete all
 * run in O(log n). Real databases (PostgreSQL B-Tree, MySQL InnoDB clustered
 * index) use B+Trees. We implement a classic B-Tree storing (key -> recordId)
 * mappings. recordId encodes the physical location (pageId + slot).
 */

const DEFAULT_ORDER = 3; // minimum degree t: each node has at most 2t-1 keys

export interface BTreeNodeData {
  leaf: boolean;
  keys: unknown[];
  values: number[][]; // parallel to keys; each entry is [pageId, slot]
  children: number[]; // child node ids (internal nodes only)
  nodeId: number;
}

export interface BTreeMeta {
  rootId: number;
  order: number;
  nextNodeId: number;
  size: number; // number of entries
}

interface CompareResult {
  eq: boolean;
  lt: boolean;
  gt: boolean;
}

// Debug mode — set via environment or programmatically
let DEBUG_BTREE = process.env.DEBUG_BTREE === "true";

export function setBTreeDebug(enabled: boolean): void {
  DEBUG_BTREE = enabled;
}

function debugLog(...args: unknown[]): void {
  if (DEBUG_BTREE) {
    console.log("[B-Tree]", ...args);
  }
}

function compareKeys(a: unknown, b: unknown): CompareResult {
  // Numeric comparison when both are numbers, otherwise string comparison.
  if (typeof a === "number" && typeof b === "number") {
    return { eq: a === b, lt: a < b, gt: a > b };
  }
  const as = String(a);
  const bs = String(b);
  if (as < bs) return { eq: false, lt: true, gt: false };
  if (as > bs) return { eq: false, lt: false, gt: true };
  return { eq: true, lt: false, gt: false };
}

export class BTreeIndex {
  private meta: BTreeMeta;
  private nodes = new Map<number, BTreeNodeData>();
  private dirty = false;

  constructor(
    private loadMeta: () => BTreeMeta | null,
    private persistMeta: (m: BTreeMeta) => void,
    private loadNode: (id: number) => BTreeNodeData | null,
    private persistNode: (n: BTreeNodeData) => void
  ) {
    const m = this.loadMeta();
    if (m) {
      this.meta = m;
      debugLog("Loaded existing B-Tree, root:", m.rootId, "size:", m.size);
    } else {
      // Create root as empty leaf
      this.meta = { rootId: 0, order: DEFAULT_ORDER, nextNodeId: 1, size: 0 };
      const root: BTreeNodeData = {
        leaf: true,
        keys: [],
        values: [],
        children: [],
        nodeId: 0,
      };
      this.nodes.set(0, root);
      this.persistMeta(this.meta);
      this.persistNode(root);
      debugLog("Created new B-Tree with empty root");
    }
  }

  get size(): number {
    return this.meta.size;
  }

  /** Insert a key -> location mapping. Replaces value if key exists. */
  insert(key: unknown, loc: number[]): void {
    debugLog("INSERT key:", key, "loc:", loc);

    const root = this.getNode(this.meta.rootId);
    const maxKeys = 2 * this.meta.order - 1;

    if (root.keys.length === maxKeys) {
      debugLog("Root is full, splitting...");
      // Root is full — split it, creating a new root.
      const newRootId = this.meta.nextNodeId++;
      const newRoot: BTreeNodeData = {
        leaf: false,
        keys: [],
        values: [],
        children: [root.nodeId],
        nodeId: newRootId,
      };
      this.nodes.set(newRootId, newRoot);
      this.splitChild(newRoot, 0, root);
      this.meta.rootId = newRootId;
      this.persistMeta(this.meta);
      this.insertNonFull(newRoot, key, loc);
    } else {
      this.insertNonFull(root, key, loc);
    }
    this.meta.size++;
    this.persistMeta(this.meta);
    this.dirty = true;
  }

  private insertNonFull(node: BTreeNodeData, key: unknown, loc: number[]): void {
    let i = node.keys.length - 1;

    if (node.leaf) {
      // FIX: Scan from right to left, moving past keys GREATER than our key
      // We want to find the rightmost position where key >= node.keys[i]
      while (i >= 0 && compareKeys(key, node.keys[i]).lt) {
        i--;
      }

      // Check if key already exists at position i
      if (i >= 0 && compareKeys(node.keys[i], key).eq) {
        debugLog("Key exists, replacing value at index", i);
        node.values[i] = loc; // replace
      } else {
        // Insert at position i+1
        debugLog("Inserting key at index", i + 1);
        node.keys.splice(i + 1, 0, key);
        node.values.splice(i + 1, 0, loc);
      }
      this.persistNode(node);
      return;
    }

    // Internal node: find the child to descend into
    // FIX: Scan from right to left, find rightmost key <= our key
    while (i >= 0 && compareKeys(key, node.keys[i]).lt) {
      i--;
    }

    // If we found an equal key, go left of it; otherwise go to child at i+1
    let childIndex = i + 1;
    if (i >= 0 && compareKeys(node.keys[i], key).eq) {
      // Key exists in internal node — update it
      node.values[i] = loc;
      this.persistNode(node);
      debugLog("Key found in internal node at index", i, ", updated");
      return;
    }

    debugLog("Descending to child index", childIndex);
    const child = this.getNode(node.children[childIndex]);

    if (child.keys.length === 2 * this.meta.order - 1) {
      debugLog("Child is full, splitting before descent");
      this.splitChild(node, childIndex, child);
      // After split, decide which child to descend into
      if (compareKeys(key, node.keys[childIndex]).gt) {
        childIndex++;
      }
    }
    this.insertNonFull(this.getNode(node.children[childIndex]), key, loc);
  }

  private splitChild(parent: BTreeNodeData, index: number, fullChild: BTreeNodeData): void {
    const order = this.meta.order;
    const mid = order - 1; // Index of the median key

    debugLog("splitChild: splitting node", fullChild.nodeId, "at parent index", index);
    debugLog("  fullChild.keys before:", JSON.stringify(fullChild.keys));

    // FIX: Extract the median key BEFORE slicing
    const medianKey = fullChild.keys[mid];
    const medianValue = fullChild.values[mid];

    debugLog("  median key:", medianKey, "at index", mid);

    // Create new sibling node for the right half
    const newNodeId = this.meta.nextNodeId++;
    const newNode: BTreeNodeData = {
      leaf: fullChild.leaf,
      keys: [],
      values: [],
      children: [],
      nodeId: newNodeId,
    };

    // Move the upper half of keys/values to the new node (everything after median)
    for (let j = mid + 1; j < fullChild.keys.length; j++) {
      newNode.keys.push(fullChild.keys[j]);
      newNode.values.push(fullChild.values[j]);
    }

    // If not a leaf, move the corresponding children too
    if (!fullChild.leaf) {
      for (let j = mid + 1; j < fullChild.children.length; j++) {
        newNode.children.push(fullChild.children[j]);
      }
      fullChild.children = fullChild.children.slice(0, mid + 1);
    }

    // Truncate the left child to only keep keys before the median
    fullChild.keys = fullChild.keys.slice(0, mid);
    fullChild.values = fullChild.values.slice(0, mid);

    debugLog("  fullChild.keys after:", JSON.stringify(fullChild.keys));
    debugLog("  newNode.keys:", JSON.stringify(newNode.keys));

    // Promote the median key into the parent
    parent.keys.splice(index, 0, medianKey);
    parent.values.splice(index, 0, medianValue);
    parent.children.splice(index + 1, 0, newNodeId);

    debugLog("  parent.keys after:", JSON.stringify(parent.keys));

    this.nodes.set(newNodeId, newNode);
    this.persistNode(newNode);
    this.persistNode(fullChild);
    this.persistNode(parent);
  }

  /** Find a single matching location for `key`, or null. */
  search(key: unknown): number[] | null {
    debugLog("SEARCH key:", key);
    return this.searchNode(this.getNode(this.meta.rootId), key);
  }

  private searchNode(node: BTreeNodeData, key: unknown): number[] | null {
    let i = 0;
    // Find first key >= target
    while (i < node.keys.length && compareKeys(key, node.keys[i]).gt) {
      i++;
    }

    if (i < node.keys.length && compareKeys(node.keys[i], key).eq) {
      debugLog("  Found at node", node.nodeId, "index", i);
      return node.values[i];
    }
    if (node.leaf) {
      debugLog("  Not found (reached leaf)");
      return null;
    }
    debugLog("  Descending to child", i);
    return this.searchNode(this.getNode(node.children[i]), key);
  }

  /** Range scan: returns all locations with keys in [low, high]. */
  rangeSearch(low: unknown, high: unknown): number[][] {
    const out: number[][] = [];
    this.rangeNode(this.getNode(this.meta.rootId), low, high, out);
    return out;
  }

  private rangeNode(node: BTreeNodeData, low: unknown, high: unknown, out: number[][]): void {
    let i = 0;
    if (node.leaf) {
      while (i < node.keys.length) {
        const k = node.keys[i];
        const cmpLow = compareKeys(k, low);
        const cmpHigh = compareKeys(k, high);
        // k >= low && k <= high
        if ((cmpLow.eq || cmpLow.gt) && (cmpHigh.eq || cmpHigh.lt)) {
          out.push(node.values[i]);
        }
        i++;
      }
      return;
    }
    // Internal node: descend into all relevant children
    while (i <= node.keys.length) {
      if (i === node.keys.length || !compareKeys(node.keys[i], low).lt) {
        this.rangeNode(this.getNode(node.children[i]), low, high, out);
      }
      if (i < node.keys.length && compareKeys(high, node.keys[i]).lt) break;
      i++;
    }
  }

  /** Remove a key from the index (if present). */
  remove(key: unknown): boolean {
    debugLog("REMOVE key:", key);
    const node = this.getNode(this.meta.rootId);
    if (node.keys.length === 0) return false;
    const removed = this.removeFromNode(node, key);
    // Shrink tree height if root became empty internal node
    if (!node.leaf && node.keys.length === 0 && node.children.length > 0) {
      this.meta.rootId = node.children[0];
      this.persistMeta(this.meta);
      debugLog("Shrunk tree height, new root:", this.meta.rootId);
    }
    if (removed) {
      this.meta.size = Math.max(0, this.meta.size - 1);
      this.persistMeta(this.meta);
    }
    this.dirty = true;
    return removed;
  }

  private removeFromNode(node: BTreeNodeData, key: unknown): boolean {
    // Find the key position
    let i = 0;
    while (i < node.keys.length && compareKeys(key, node.keys[i]).gt) {
      i++;
    }

    if (i < node.keys.length && compareKeys(node.keys[i], key).eq) {
      if (node.leaf) {
        debugLog("Removing from leaf at index", i);
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
        this.persistNode(node);
        return true;
      }
      // Internal: replace with predecessor (simplified)
      debugLog("Removing from internal node, finding predecessor");
      const pred = this.maxKeyNode(this.getNode(node.children[i]));
      const pIdx = pred.keys.length - 1;
      node.keys[i] = pred.keys[pIdx];
      node.values[i] = pred.values[pIdx];
      this.removeFromNode(pred, pred.keys[pIdx]);
      this.persistNode(node);
      return true;
    }

    if (node.leaf) return false; // not found
    return this.removeFromNode(this.getNode(node.children[i]), key);
  }

  private maxKeyNode(node: BTreeNodeData): BTreeNodeData {
    if (node.leaf) return node;
    return this.maxKeyNode(this.getNode(node.children[node.children.length - 1]));
  }

  private getNode(id: number): BTreeNodeData {
    const cached = this.nodes.get(id);
    if (cached) return cached;
    const loaded = this.loadNode(id);
    if (!loaded) throw new Error(`B-Tree node ${id} missing`);
    this.nodes.set(id, loaded);
    return loaded;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  markClean(): void {
    this.dirty = false;
  }

  /** Return the in-memory node map (used for persistence). */
  getNodes(): Map<number, BTreeNodeData> {
    return this.nodes;
  }

  /** Seed a node into the in-memory cache (used when loading from disk). */
  seedNode(node: BTreeNodeData): void {
    this.nodes.set(node.nodeId, node);
  }

  /** Persist the current meta + nodes to disk via the provided callbacks. */
  sync(): void {
    this.persistMeta(this.meta);
    for (const node of this.nodes.values()) {
      this.persistNode(node);
    }
    this.dirty = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG / INSPECTION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get a debug snapshot of the entire tree structure */
  getDebugSnapshot(): {
    meta: BTreeMeta;
    nodes: Array<{ nodeId: number; keys: unknown[]; leaf: boolean; childCount: number }>;
    treeStructure: string;
  } {
    const nodesArr = Array.from(this.nodes.values()).map((n) => ({
      nodeId: n.nodeId,
      keys: n.keys,
      leaf: n.leaf,
      childCount: n.children.length,
    }));

    return {
      meta: { ...this.meta },
      nodes: nodesArr,
      treeStructure: this.visualizeTree(),
    };
  }

  /** ASCII visualization of the tree structure */
  visualizeTree(): string {
    const lines: string[] = [];
    this.visualizeNode(this.getNode(this.meta.rootId), 0, lines);
    return lines.join("\n");
  }

  private visualizeNode(node: BTreeNodeData, depth: number, lines: string[]): void {
    const indent = "  ".repeat(depth);
    const nodeType = node.leaf ? "LEAF" : "INTERNAL";
    lines.push(`${indent}[${node.nodeId}] ${nodeType}: keys=[${node.keys.join(", ")}]`);
    if (!node.leaf) {
      for (let i = 0; i < node.children.length; i++) {
        try {
          const child = this.getNode(node.children[i]);
          this.visualizeNode(child, depth + 1, lines);
        } catch {
          lines.push(`${indent}  [${node.children[i]}] <missing>`);
        }
      }
    }
  }

  /** Validate tree invariants (for debugging) */
  validateTree(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    this.validateNode(this.getNode(this.meta.rootId), null, null, errors);
    return { valid: errors.length === 0, errors };
  }

  private validateNode(
    node: BTreeNodeData,
    minKey: unknown | null,
    maxKey: unknown | null,
    errors: string[]
  ): void {
    // Check key ordering within node
    for (let i = 1; i < node.keys.length; i++) {
      if (!compareKeys(node.keys[i - 1], node.keys[i]).lt) {
        errors.push(`Node ${node.nodeId}: keys not sorted at index ${i}`);
      }
    }

    // Check bounds
    if (minKey !== null && node.keys.length > 0) {
      if (compareKeys(node.keys[0], minKey).lt) {
        errors.push(`Node ${node.nodeId}: first key ${node.keys[0]} < minKey ${minKey}`);
      }
    }
    if (maxKey !== null && node.keys.length > 0) {
      const lastKey = node.keys[node.keys.length - 1];
      if (compareKeys(lastKey, maxKey).gt) {
        errors.push(`Node ${node.nodeId}: last key ${lastKey} > maxKey ${maxKey}`);
      }
    }

    // Recurse into children
    if (!node.leaf) {
      for (let i = 0; i < node.children.length; i++) {
        const childMin = i > 0 ? node.keys[i - 1] : minKey;
        const childMax = i < node.keys.length ? node.keys[i] : maxKey;
        try {
          this.validateNode(this.getNode(node.children[i]), childMin, childMax, errors);
        } catch {
          errors.push(`Node ${node.nodeId}: missing child ${node.children[i]}`);
        }
      }
    }
  }
}
