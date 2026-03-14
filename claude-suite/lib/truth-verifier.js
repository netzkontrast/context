'use strict';

/**
 * Truth Verification Layer — Statistical Output Validation
 *
 * Verifies agent outputs against registered JSON schemas and computes a
 * confidence score (0.0–1.0). Outputs below the registered threshold are
 * rejected, preventing hallucinated or malformed agent payloads from
 * corrupting system state.
 *
 * Confidence formula:
 *   confidence = passed_checks / total_checks
 *
 * A check is added for every type assertion, required-field presence test,
 * numeric range constraint, enum membership test, and string length check.
 * This gives a fine-grained signal rather than a binary pass/fail.
 *
 * Default threshold: 0.8 (80 % of checks must pass).
 * Per-schema thresholds override the default.
 */

class TruthVerifier {
  constructor(options = {}) {
    this._schemas = new Map();
    this._thresholds = new Map();
    this._defaultThreshold = options.defaultThreshold !== undefined
      ? options.defaultThreshold
      : 0.8;
  }

  /**
   * Register a JSON-schema-like descriptor for a named output type.
   *
   * Supported keywords (subset of JSON Schema draft-07):
   *   type, required, properties
   *
   * Supported property keywords:
   *   type, minimum, maximum, enum, minLength, maxLength
   *
   * @param {string}  name      - Identifier for the schema
   * @param {object}  schema    - Schema descriptor
   * @param {number}  [threshold] - Override default threshold (0.0–1.0)
   */
  register(name, schema, threshold = null) {
    this._schemas.set(name, schema);
    if (threshold !== null) {
      this._thresholds.set(name, threshold);
    }
  }

  setThreshold(name, threshold) {
    this._thresholds.set(name, threshold);
  }

  getThreshold(name) {
    return this._thresholds.has(name)
      ? this._thresholds.get(name)
      : this._defaultThreshold;
  }

  /**
   * Validate `data` against a registered schema.
   *
   * @param {*}      data        - The value to validate
   * @param {string} schemaName  - The registered schema identifier
   * @returns {{ valid: boolean, errors: string[], confidence: number,
   *             checks: { total: number, passed: number } }}
   */
  verify(data, schemaName) {
    const schema = this._schemas.get(schemaName);
    if (!schema) {
      throw new Error(`No schema registered: ${schemaName}`);
    }

    const errors = [];
    const checks = [];  // boolean per assertion

    const addCheck = (passed, errorMsg) => {
      checks.push(passed);
      if (!passed) errors.push(errorMsg);
    };

    // ── Root type check ──────────────────────────────────────────────────────
    if (schema.type) {
      const actual = Array.isArray(data) ? 'array' : typeof data;
      addCheck(
        actual === schema.type,
        `Expected root type '${schema.type}', got '${actual}'`,
      );
    }

    // ── Object-level checks ──────────────────────────────────────────────────
    if (schema.type === 'object' && data !== null && typeof data === 'object' && !Array.isArray(data)) {

      // Required fields
      if (Array.isArray(schema.required)) {
        for (const field of schema.required) {
          addCheck(
            data[field] !== undefined,
            `Missing required field: '${field}'`,
          );
        }
      }

      // Per-property constraints
      if (schema.properties && typeof schema.properties === 'object') {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (data[key] === undefined) continue;  // absence handled by required
          const value = data[key];

          // Type
          if (propSchema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            addCheck(
              actualType === propSchema.type,
              `Field '${key}': expected type '${propSchema.type}', got '${actualType}'`,
            );
          }

          // Numeric range
          if (typeof value === 'number') {
            if (propSchema.minimum !== undefined) {
              addCheck(
                value >= propSchema.minimum,
                `Field '${key}': ${value} is below minimum ${propSchema.minimum}`,
              );
            }
            if (propSchema.maximum !== undefined) {
              addCheck(
                value <= propSchema.maximum,
                `Field '${key}': ${value} exceeds maximum ${propSchema.maximum}`,
              );
            }
          }

          // Enum membership
          if (Array.isArray(propSchema.enum)) {
            addCheck(
              propSchema.enum.includes(value),
              `Field '${key}': '${value}' not in enum [${propSchema.enum.join(', ')}]`,
            );
          }

          // String length
          if (typeof value === 'string') {
            if (propSchema.minLength !== undefined) {
              addCheck(
                value.length >= propSchema.minLength,
                `Field '${key}': length ${value.length} < minLength ${propSchema.minLength}`,
              );
            }
            if (propSchema.maxLength !== undefined) {
              addCheck(
                value.length <= propSchema.maxLength,
                `Field '${key}': length ${value.length} > maxLength ${propSchema.maxLength}`,
              );
            }
          }
        }
      }
    }

    const total = checks.length;
    const passed = checks.filter(Boolean).length;
    const confidence = total === 0 ? 1.0 : passed / total;

    return {
      valid: errors.length === 0,
      errors,
      confidence,
      checks: { total, passed },
    };
  }

  /**
   * Verify `data` and compare confidence against the schema's threshold.
   *
   * @returns {{ passed: boolean, threshold: number,
   *             result: ReturnType<TruthVerifier['verify']> }}
   */
  check(data, schemaName) {
    const result = this.verify(data, schemaName);
    const threshold = this.getThreshold(schemaName);
    const passed = result.valid && result.confidence >= threshold;
    return { passed, threshold, result };
  }
}

// ── Pre-configured factory ────────────────────────────────────────────────────

/**
 * Create a TruthVerifier pre-loaded with the standard schemas used by the
 * Claude Suite runtime:
 *   - 'agent-report'  — output emitted by agent-runner.js
 *   - 'wave-result'   — a single completed wave from the orchestrator
 */
function createAgentVerifier(options = {}) {
  const verifier = new TruthVerifier(options);

  // AgentRunner output schema (see lib/agent-runner.js)
  verifier.register('agent-report', {
    type: 'object',
    required: ['agentId', 'task', 'status', 'mcpTools'],
    properties: {
      agentId:         { type: 'string',  minLength: 1 },
      task:            { type: 'string',  minLength: 1 },
      status:          { type: 'string',  enum: ['ready', 'completed', 'failed'] },
      nyquistEnabled:  { type: 'boolean' },
      skipPermissions: { type: 'boolean' },
      mcpTools:        { type: 'array' },
      message:         { type: 'string' },
    },
  }, 0.85);

  // Orchestrator wave-result schema
  verifier.register('wave-result', {
    type: 'object',
    required: ['waveIndex', 'tasks'],
    properties: {
      waveIndex: { type: 'number', minimum: 0 },
      tasks:     { type: 'array' },
    },
  }, 1.0);

  return verifier;
}

module.exports = { TruthVerifier, createAgentVerifier };
