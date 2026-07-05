// Validator Agent: Validates execution results for correctness
import type { ParsedQuery, ExecutionResult } from "../types";

export class ValidatorAgent {
  readonly name = "Validator Agent";

  validate(
    query: ParsedQuery,
    result: { data: unknown; rowCount: number }
  ): { valid: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check result integrity
    if (result.data === undefined || result.data === null) {
      if (query.type === "SELECT") {
        issues.push("SELECT returned null/undefined data");
      }
    }

    // Validate SELECT results
    if (query.type === "SELECT" && Array.isArray(result.data)) {
      // Check column consistency
      if (result.data.length > 0) {
        const firstRowKeys = Object.keys(result.data[0] as Record<string, unknown>);
        for (let i = 1; i < result.data.length; i++) {
          const rowKeys = Object.keys(result.data[i] as Record<string, unknown>);
          if (rowKeys.length !== firstRowKeys.length) {
            issues.push(`Row ${i} has inconsistent column count`);
          }
        }
      }

      // Check if projection was applied correctly
      if (query.columns && !query.columns.includes("*") && result.data.length > 0) {
        const rowKeys = Object.keys(result.data[0] as Record<string, unknown>);
        for (const col of query.columns) {
          if (!rowKeys.includes(col)) {
            issues.push(`Requested column '${col}' missing from results`);
          }
        }
      }

      // Check LIMIT was applied
      if (query.limit && result.data.length > query.limit) {
        issues.push(`LIMIT ${query.limit} not applied — got ${result.data.length} rows`);
      }
    }

    // Check for large result sets
    if (result.rowCount > 1000) {
      suggestions.push("Large result set — consider adding LIMIT or WHERE clause");
    }

    // Validate write operations
    if (query.type === "INSERT" && query.values) {
      if (result.rowCount !== query.values.length) {
        issues.push(`Expected to insert ${query.values.length} rows, but inserted ${result.rowCount}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
    };
  }
}
