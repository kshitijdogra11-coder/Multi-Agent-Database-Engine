// Parser Agent: Tokenizes and parses SQL into an AST
import type { ParsedQuery, QueryType, Condition, ColumnDef } from "../types";

export class ParserAgent {
  readonly name = "Parser Agent";

  parse(sql: string): { parsed: ParsedQuery; confidence: number; errors: string[] } {
    const startTime = performance.now();
    const errors: string[] = [];
    const trimmed = sql.trim().replace(/;$/, "").trim();
    const upper = trimmed.toUpperCase();

    let parsed: ParsedQuery = { type: "UNKNOWN", raw: trimmed };
    let confidence = 0;

    try {
      if (upper.startsWith("CREATE TABLE")) {
        parsed = this.parseCreateTable(trimmed);
        confidence = 0.95;
      } else if (upper.startsWith("DROP TABLE")) {
        parsed = this.parseDropTable(trimmed);
        confidence = 0.95;
      } else if (upper.startsWith("INSERT INTO")) {
        parsed = this.parseInsert(trimmed);
        confidence = 0.9;
      } else if (upper.startsWith("SELECT")) {
        parsed = this.parseSelect(trimmed);
        confidence = 0.9;
      } else if (upper.startsWith("UPDATE")) {
        parsed = this.parseUpdate(trimmed);
        confidence = 0.9;
      } else if (upper.startsWith("DELETE FROM")) {
        parsed = this.parseDelete(trimmed);
        confidence = 0.9;
      } else if (upper === "SHOW TABLES") {
        parsed = { type: "SHOW_TABLES", raw: trimmed };
        confidence = 1.0;
      } else if (upper.startsWith("DESCRIBE") || upper.startsWith("DESC ")) {
        const parts = trimmed.split(/\s+/);
        parsed = { type: "DESCRIBE", table: parts[1], raw: trimmed };
        confidence = 0.95;
      } else {
        errors.push(`Unrecognized SQL command: ${trimmed.substring(0, 30)}...`);
        confidence = 0;
      }
    } catch (e) {
      errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
      confidence = 0;
    }

    return { parsed, confidence, errors };
  }

  private parseCreateTable(sql: string): ParsedQuery {
    // CREATE TABLE name (col1 TYPE, col2 TYPE, ...)
    const match = sql.match(/CREATE\s+TABLE\s+(\w+)\s*\((.+)\)/i);
    if (!match) throw new Error("Invalid CREATE TABLE syntax");

    const tableName = match[1];
    const colDefs = match[2].split(",").map((col) => col.trim());
    const schema: ColumnDef[] = colDefs.map((def) => {
      const parts = def.split(/\s+/);
      const name = parts[0];
      const typeStr = (parts[1] || "TEXT").toUpperCase();
      let type: ColumnDef["type"] = "TEXT";
      if (typeStr.includes("INT")) type = "INTEGER";
      else if (typeStr.includes("REAL") || typeStr.includes("FLOAT") || typeStr.includes("DOUBLE") || typeStr.includes("NUMERIC")) type = "REAL";
      else if (typeStr.includes("BOOL")) type = "BOOLEAN";

      const isPK = def.toUpperCase().includes("PRIMARY KEY");
      const isNullable = !def.toUpperCase().includes("NOT NULL") && !isPK;

      return { name, type, nullable: isNullable, primaryKey: isPK };
    });

    return { type: "CREATE_TABLE", table: tableName, schema, raw: sql };
  }

  private parseDropTable(sql: string): ParsedQuery {
    const match = sql.match(/DROP\s+TABLE\s+(\w+)/i);
    if (!match) throw new Error("Invalid DROP TABLE syntax");
    return { type: "DROP_TABLE", table: match[1], raw: sql };
  }

  private parseInsert(sql: string): ParsedQuery {
    // INSERT INTO table (cols) VALUES (vals), (vals)
    const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s+(.+)/i);
    if (!match) throw new Error("Invalid INSERT syntax. Use: INSERT INTO table (col1, col2) VALUES (val1, val2)");

    const table = match[1];
    const columns = match[2].split(",").map((c) => c.trim());

    // Parse multiple value groups
    const valuesStr = match[3];
    const valueGroups = valuesStr.match(/\(([^)]+)\)/g);
    if (!valueGroups) throw new Error("Invalid VALUES clause");

    const values = valueGroups.map((group) => {
      const vals = group
        .slice(1, -1)
        .split(",")
        .map((v) => {
          const trimmed = v.trim();
          // Remove quotes
          if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
            return trimmed.slice(1, -1);
          }
          if (trimmed.toUpperCase() === "NULL") return null;
          if (trimmed.toUpperCase() === "TRUE") return true;
          if (trimmed.toUpperCase() === "FALSE") return false;
          const num = Number(trimmed);
          return isNaN(num) ? trimmed : num;
        });

      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = vals[i] ?? null;
      });
      return row;
    });

    return { type: "INSERT", table, columns, values, raw: sql };
  }

  private parseSelect(sql: string): ParsedQuery {
    // SELECT cols FROM table [WHERE ...] [ORDER BY ...] [LIMIT n]
    const match = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(.*)/i);
    if (!match) throw new Error("Invalid SELECT syntax");

    const colStr = match[1].trim();
    const columns = colStr === "*" ? ["*"] : colStr.split(",").map((c) => c.trim());
    const table = match[2];
    const rest = match[3]?.trim() || "";

    const conditions = this.parseWhere(rest);
    const orderBy = this.parseOrderBy(rest);
    const limit = this.parseLimit(rest);

    return { type: "SELECT", table, columns, conditions, orderBy, limit, raw: sql };
  }

  private parseUpdate(sql: string): ParsedQuery {
    // UPDATE table SET col1 = val1, col2 = val2 [WHERE ...]
    const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (!match) throw new Error("Invalid UPDATE syntax");

    const table = match[1];
    const setParts = match[2].split(",").map((s) => s.trim());
    const updates: Record<string, unknown> = {};
    setParts.forEach((part) => {
      const [col, val] = part.split("=").map((s) => s.trim());
      updates[col] = this.parseValue(val);
    });

    const conditions = match[3] ? this.parseConditions(match[3]) : [];

    return { type: "UPDATE", table, updates, conditions, raw: sql };
  }

  private parseDelete(sql: string): ParsedQuery {
    const match = sql.match(/DELETE\s+FROM\s+(\w+)(.*)/i);
    if (!match) throw new Error("Invalid DELETE syntax");

    const table = match[1];
    const rest = match[2]?.trim() || "";
    const conditions = this.parseWhere(rest);

    return { type: "DELETE", table, conditions, raw: sql };
  }

  private parseWhere(rest: string): Condition[] {
    const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (!whereMatch) return [];
    return this.parseConditions(whereMatch[1]);
  }

  private parseConditions(condStr: string): Condition[] {
    const conditions: Condition[] = [];
    // Split on AND (simple — no OR support for mini engine)
    const parts = condStr.split(/\s+AND\s+/i);
    for (const part of parts) {
      const opMatch = part.match(/(\w+)\s*(!=|>=|<=|>|<|=|LIKE)\s*(.+)/i);
      if (opMatch) {
        conditions.push({
          column: opMatch[1].trim(),
          operator: opMatch[2].toUpperCase() as Condition["operator"],
          value: this.parseValue(opMatch[3].trim()),
        });
      }
    }
    return conditions;
  }

  private parseOrderBy(rest: string): ParsedQuery["orderBy"] {
    const match = rest.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (!match) return undefined;
    return {
      column: match[1],
      direction: (match[2]?.toUpperCase() as "ASC" | "DESC") || "ASC",
    };
  }

  private parseLimit(rest: string): number | undefined {
    const match = rest.match(/LIMIT\s+(\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private parseValue(val: string): unknown {
    const trimmed = val.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    if (trimmed.toUpperCase() === "NULL") return null;
    if (trimmed.toUpperCase() === "TRUE") return true;
    if (trimmed.toUpperCase() === "FALSE") return false;
    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
  }
}
