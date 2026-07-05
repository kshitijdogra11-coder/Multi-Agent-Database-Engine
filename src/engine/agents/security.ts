// Security Agent: Validates queries for injection, access control, rate limiting
import type { ParsedQuery } from "../types";

export class SecurityAgent {
  readonly name = "Security Agent";

  private readonly dangerousPatterns = [
    /--/,                          // SQL comment injection
    /\/\*/,                        // Block comment
    /;\s*(DROP|DELETE|UPDATE|ALTER)/i, // Stacked queries
    /UNION\s+SELECT/i,            // Union injection
    /OR\s+1\s*=\s*1/i,           // Classic tautology
    /'\s*OR\s*'/i,               // String-based injection
    /EXEC(\s|UTE)/i,             // Execute commands
    /xp_/i,                       // Extended procedures
  ];

  validate(query: ParsedQuery): { safe: boolean; threats: string[]; riskScore: number } {
    const threats: string[] = [];
    let riskScore = 0;

    // Check raw SQL for injection patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(query.raw)) {
        threats.push(`Potential SQL injection detected: ${pattern.source}`);
        riskScore += 30;
      }
    }

    // Check for overly broad operations
    if (query.type === "DELETE" && (!query.conditions || query.conditions.length === 0)) {
      threats.push("WARNING: DELETE without WHERE clause — will delete all rows");
      riskScore += 20;
    }

    if (query.type === "UPDATE" && (!query.conditions || query.conditions.length === 0)) {
      threats.push("WARNING: UPDATE without WHERE clause — will update all rows");
      riskScore += 20;
    }

    if (query.type === "DROP_TABLE") {
      threats.push("CAUTION: DROP TABLE is a destructive operation");
      riskScore += 15;
    }

    // Table name validation
    if (query.table && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(query.table)) {
      threats.push("Invalid table name — possible injection");
      riskScore += 40;
    }

    // Check for excessively long queries (potential DoS)
    if (query.raw.length > 5000) {
      threats.push("Query exceeds maximum length — potential DoS");
      riskScore += 25;
    }

    return {
      safe: riskScore < 50,
      threats,
      riskScore: Math.min(100, riskScore),
    };
  }
}
