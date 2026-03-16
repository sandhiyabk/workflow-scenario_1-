import { Parser } from 'expr-eval';
import { logger } from '../utils/logger.js';

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
 */
export class RuleEngine {
  public evaluate(condition: string, data: RuleData): boolean {
    if (!condition || condition.trim().toUpperCase() === 'DEFAULT') {
      return true;
    }

    try {
      let expr = this.preprocess(condition, data);
      const result = parser.evaluate(expr, this.sanitizeData(data));
      return !!result;
    } catch (error: any) {
      logger.error(`[RuleEngine] Failed to evaluate condition: "${condition}"`, { error: error.message });
      return false;
    }
  }

  private preprocess(condition: string, data: RuleData): string {
    let expr = condition;
    expr = expr.replace(/contains\((\w+),\s*['"](.+?)['"]\)/g, (_, field, value) => {
      const fieldVal = data[field];
      const result = fieldVal != null && String(fieldVal).toLowerCase().includes(value.toLowerCase());
      return result ? '1' : '0';
    });
    expr = expr.replace(/startsWith\((\w+),\s*['"](.+?)['"]\)/g, (_, field, value) => {
      const fieldVal = data[field];
      const result = fieldVal != null && String(fieldVal).startsWith(value);
      return result ? '1' : '0';
    });
    expr = expr.replace(/endsWith\((\w+),\s*['"](.+?)['"]\)/g, (_, field, value) => {
      const fieldVal = data[field];
      const result = fieldVal != null && String(fieldVal).endsWith(value);
      return result ? '1' : '0';
    });

    expr = this.replaceOutsideStrings(expr, '&&', ' and ');
    expr = this.replaceOutsideStrings(expr, '||', ' or ');
    expr = this.replaceOutsideStrings(expr, '==', '=');
    expr = expr.replace(/!=/g, '!=');
    expr = expr.replace(/===/g, '=');

    return expr;
  }

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

  private sanitizeData(data: RuleData): Record<string, any> {
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safe[key] = value;
      } else if (value === null || value === undefined) {
        safe[key] = null;
      } else {
        safe[key] = JSON.stringify(value);
      }
    }
    return safe;
  }
}
