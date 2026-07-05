import { NextRequest, NextResponse } from "next/server";

const KNOWLEDGE_BASE: Record<string, string> = {
  "create table": "Use: CREATE TABLE name (col1 TYPE, col2 TYPE)\nTypes: TEXT, INTEGER, REAL, BOOLEAN\nConstraints: PRIMARY KEY, NOT NULL\n\nExample:\nCREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER)",
  "insert": "Use: INSERT INTO table (col1, col2) VALUES (val1, val2)\nMultiple rows: VALUES (a,b), (c,d)\n\nExample:\nINSERT INTO students (id, name, age) VALUES (1, 'Alice', 20)",
  "select": "Use: SELECT columns FROM table [WHERE cond] [ORDER BY col ASC|DESC] [LIMIT n]\n\nExamples:\nSELECT * FROM students\nSELECT name FROM students WHERE age > 18\nSELECT * FROM students ORDER BY age DESC LIMIT 5",
  "update": "Use: UPDATE table SET col = val [WHERE cond]\n\nExample:\nUPDATE students SET age = 21 WHERE name = 'Alice'",
  "delete": "Use: DELETE FROM table [WHERE cond]\n\nExample:\nDELETE FROM students WHERE id = 3",
  "show": "Use: SHOW TABLES — lists all tables\nUse: DESCRIBE tablename — shows column definitions",
  "btree": "The B-Tree index provides O(log n) lookups on PRIMARY KEY columns. When you query WHERE id = 5, the engine uses the B-Tree to jump directly to the record instead of scanning every page.",
  "buffer": "The Buffer Pool is an LRU cache holding up to 64 pages in memory. When a page is accessed, it's loaded into a frame. The least-recently-used page is evicted when the pool is full.",
  "storage": "The Storage Manager organizes data into 4KB pages. Each page holds multiple records. Pages are linked per-table and persisted to disk as JSON files.",
  "index": "Indexes speed up lookups from O(n) to O(log n). MiniDB automatically creates a B-Tree index on PRIMARY KEY columns. Use DESCRIBE to see which columns are indexed.",
  "constraint": "MiniDB supports: PRIMARY KEY (unique, not null), NOT NULL (prevents null values), UNIQUE (enforced via B-Tree index). Violations return clear error messages.",
  "agent": "The multi-agent pipeline processes every query through 7 agents:\n1. Parser — SQL → AST\n2. Security — Threat detection\n3. Planner — Cost-based planning\n4. ML Optimizer — Learned cost corrections\n5. Executor — Runs the plan\n6. Validator — Verifies results\n7. Orchestrator — Coordinates everything",
  "help": "I can help with:\n• SQL syntax (CREATE, SELECT, INSERT, UPDATE, DELETE)\n• Engine internals (B-Tree, buffer pool, storage)\n• Architecture (agents, pipeline)\n• Troubleshooting query errors\n\nJust ask a question!",
};

function findAnswer(question: string): string {
  const q = question.toLowerCase().trim();

  if (q.includes("hello") || q.includes("hi ") || q === "hi" || q.includes("hey")) {
    return "Hello! 👋 I'm the MiniDB assistant. I can help you with SQL queries, engine internals, and architecture questions. What would you like to know?";
  }

  for (const [key, answer] of Object.entries(KNOWLEDGE_BASE)) {
    if (q.includes(key)) return answer;
  }

  if (q.includes("how") && q.includes("work")) {
    return "MiniDB processes queries through a pipeline:\n1. You write SQL\n2. Parser converts it to an AST\n3. Security agent checks for threats\n4. Planner creates an execution plan\n5. ML Optimizer improves cost estimates\n6. Executor runs the plan against the storage engine\n7. Validator verifies the results\n\nThe storage engine uses pages, B-Tree indexes, and an LRU buffer pool — just like real databases!";
  }

  if (q.includes("example") || q.includes("demo") || q.includes("try")) {
    return "Try these queries in the console:\n\n1. CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, author TEXT, year INTEGER)\n2. INSERT INTO books (id, title, author, year) VALUES (1, 'DBMS Concepts', 'Silberschatz', 2019)\n3. SELECT * FROM books\n4. SHOW TABLES";
  }

  if (q.includes("error") || q.includes("fail") || q.includes("wrong")) {
    return "Common issues:\n• 'Table does not exist' — CREATE the table first\n• 'NOT NULL constraint' — Provide all required columns\n• 'PRIMARY KEY constraint' — Use a unique ID value\n• Syntax error — Check SQL format: SELECT cols FROM table WHERE cond";
  }

  return "I'm not sure about that. Try asking about:\n• SQL commands (CREATE, SELECT, INSERT, UPDATE, DELETE)\n• Engine internals (B-Tree, buffer pool, storage, indexing)\n• Architecture (agents, pipeline)\n• Examples and demos\n\nOr type 'help' for a full list of topics!";
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    const reply = findAnswer(message);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
