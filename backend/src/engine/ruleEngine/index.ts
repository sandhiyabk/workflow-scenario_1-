import { Parser } from 'expr-eval';

export type RuleData = Record<string, any>;

export interface RuleEvaluationResult {
  isMatch: boolean;
  ruleId?: string;
  nextStepId?: string | null;
}

const parser = new Parser({
  operators: {
    logical: true,
    comparison: true,
    in: true,
  }
});

/**
 * Safe Rule Engine using expr-eval — no eval(), no new Function()
 * 
 * Supports:
 *   - Numeric comparisons: amount > 100, amount <= 500
 *   - String equality: country == 'US', status != 'pending'
 *   - Logical operators: &&, ||, and, or
 *   - Ternary: not supported (intentionally)
 *   - String functions: via pre-processing (contains, startsWith, endsWith)
 *   - Special keyword: DEFAULT (always true — fallback rule)
 * 
 * Example conditions:
 *   "amount > 100 && country == 'US' && priority == 'High'"
 *   "hr_verified == true"
 *   "department == 'Engineering' || department == 'Finance'"
 *   "contains(email, '@company.com')"
 *   "DEFAULT"
 */
export class RuleEngine {
  public evaluate(condition: string, data: RuleData): boolean {
    if (!condition || condition.trim().toUpperCase() === 'DEFAULT') {
      return true;
    }

    try {
      // Pre-process condition: normalize operators and handle functions
      let expr = this.preprocess(condition, data);

      // Evaluate using expr-eval parser (safe sandbox, no RCE possible)
      const result = parser.evaluate(expr, this.sanitizeData(data));
      return !!result;
    } catch (error: any) {
      console.error(`[RuleEngine] Failed to evaluate condition: "${condition}"`, error.message);
      return false;
    }
  }

  /**
   * Pre-process condition string:
   * - Convert && → and, || → or (expr-eval uses word operators)
   * - Resolve contains(), startsWith(), endsWith() to boolean 1/0
   */
  private preprocess(condition: string, data: RuleData): string {
    let expr = condition;

    // Handle contains(field, 'value') — resolve immediately from data
    expr = expr.replace(/contains\((\w+),\s*['"](.+?)['"]\)/g, (_, field, value) => {
      const fieldVal = data[field];
      const result = fieldVal != null && String(fieldVal).toLowerCase().includes(value.toLowerCase());
      return result ? '1' : '0';
    });

    // Handle startsWith(field, 'prefix')
    expr = expr.replace(/startsWith\((\w+),\s*['"](.+?)['"]\)/g, (_, field, value) => {
      const fieldVal = data[field];
      const result = fieldVal != null && String(fieldVal).startsWith(value);
      return result ? '1' : '0';
    });

    // Handle endsWith(field, 'suffix')
    expr = expr.replace(/endsWith\((\w+),\s*['"](.+?)['"]\)/g, (_, field, value) => {
      const fieldVal = data[field];
      const result = fieldVal != null && String(fieldVal).endsWith(value);
      return result ? '1' : '0';
    });

    // Normalize JavaScript logical ops to expr-eval's word-based operators
    // Replace && with ' and ' — but not inside strings
    expr = this.replaceOutsideStrings(expr, '&&', ' and ');
    expr = this.replaceOutsideStrings(expr, '||', ' or ');

    // Normalize == to = for expr-eval (it uses single = for equality)
    // But don't touch != which expr-eval supports natively
    expr = this.replaceOutsideStrings(expr, '==', '=');
    // Revert !== back (if someone used it) to != 
    expr = expr.replace(/!=/g, '!=');
    // Fix: === should also become =
    expr = expr.replace(/===/g, '=');

    return expr;
  }

  /**
   * Replace a pattern in condition string, but only outside quoted string sections
   */
  private replaceOutsideStrings(str: string, search: string, replacement: string): string {
    const parts: string[] = [];
    let inString = false;
    let stringChar = '';
    let current = '';

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (!inString && (ch === '"' || ch === "'")) {
        inString = true;
        stringChar = ch;
        current += ch;
      } else if (inString && ch === stringChar && str[i - 1] !== '\\') {
        inString = false;
        current += ch;
      } else if (!inString && str.startsWith(search, i)) {
        parts.push(current);
        parts.push(replacement);
        current = '';
        i += search.length - 1;
      } else {
        current += ch;
      }
    }
    parts.push(current);
    return parts.join('');
  }

  /**
   * Sanitize data to only include primitive-safe values for expr-eval
   */
  private sanitizeData(data: RuleData): Record<string, any> {
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safe[key] = value;
      } else if (value === null || value === undefined) {
        safe[key] = null;
      } else {
        // Stringify objects/arrays so at least they won't break the evaluator
        safe[key] = JSON.stringify(value);
      }
    }
    return safe;
  }
}
