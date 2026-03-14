'use strict';

/**
 * Hooks — Deterministic OS-level lifecycle hooks
 *
 * Provides a structured hook system for the Claude Suite orchestrator.
 * Hooks fire at deterministic points in the agent execution lifecycle:
 *
 *   PreToolUse  → Before any MCP tool is invoked (can block execution)
 *   PostToolUse → After an MCP tool completes (can inspect/transform output)
 *   EndOfTurn   → After an agent completes its full execution cycle
 *
 * Hooks are composable: multiple handlers can be registered for the same event.
 * PreToolUse hooks can return { allow: false } to veto tool execution.
 *
 * Integration with Nyquist:
 *   The built-in safety hook runs Nyquist classification on shell commands
 *   before execution, blocking BLOCKED commands and flagging GUARDED ones.
 */

const { classifyCommand, CLASSIFICATION } = require('./nyquist');

const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'EndOfTurn'];

class HookRegistry {
  constructor() {
    this._hooks = new Map();
    for (const event of HOOK_EVENTS) {
      this._hooks.set(event, []);
    }
  }

  /**
   * Register a hook handler.
   *
   * @param {string} event - One of HOOK_EVENTS
   * @param {Object} handler
   * @param {string} handler.name - Unique handler name
   * @param {number} [handler.priority=100] - Lower runs first
   * @param {Function} handler.fn - The hook function
   *   PreToolUse:  (context) => { allow: boolean, reason?: string }
   *   PostToolUse: (context) => { output?: any, transformed?: boolean }
   *   EndOfTurn:   (context) => void
   */
  register(event, handler) {
    if (!HOOK_EVENTS.includes(event)) {
      throw new Error(`Invalid hook event: ${event}. Must be one of: ${HOOK_EVENTS.join(', ')}`);
    }
    if (!handler.name || typeof handler.fn !== 'function') {
      throw new Error('Hook handler requires name and fn');
    }

    const hooks = this._hooks.get(event);

    // Prevent duplicate registration
    const existing = hooks.findIndex(h => h.name === handler.name);
    if (existing !== -1) {
      hooks[existing] = { ...handler, priority: handler.priority ?? 100 };
    } else {
      hooks.push({ ...handler, priority: handler.priority ?? 100 });
    }

    // Sort by priority (lower first)
    hooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregister a hook handler by name.
   *
   * @param {string} event
   * @param {string} handlerName
   * @returns {boolean} Whether the handler was found and removed
   */
  unregister(event, handlerName) {
    if (!this._hooks.has(event)) return false;
    const hooks = this._hooks.get(event);
    const idx = hooks.findIndex(h => h.name === handlerName);
    if (idx === -1) return false;
    hooks.splice(idx, 1);
    return true;
  }

  /**
   * List registered hooks for an event.
   *
   * @param {string} event
   * @returns {Array<{ name: string, priority: number }>}
   */
  list(event) {
    if (!this._hooks.has(event)) return [];
    return this._hooks.get(event).map(h => ({ name: h.name, priority: h.priority }));
  }

  /**
   * Execute PreToolUse hooks. Returns aggregated decision.
   * If ANY hook returns { allow: false }, execution is blocked.
   *
   * @param {Object} context
   * @param {string} context.tool - Tool name being invoked
   * @param {Object} context.params - Tool parameters
   * @param {string} [context.agentId] - Agent requesting the tool
   * @returns {{ allow: boolean, decisions: Array<{ name: string, allow: boolean, reason?: string }> }}
   */
  runPreToolUse(context) {
    const hooks = this._hooks.get('PreToolUse');
    const decisions = [];

    for (const hook of hooks) {
      const result = hook.fn(context);
      decisions.push({
        name: hook.name,
        allow: result.allow !== false,
        reason: result.reason || null,
      });
    }

    const allow = decisions.every(d => d.allow);
    return { allow, decisions };
  }

  /**
   * Execute PostToolUse hooks. Each hook can transform the output.
   *
   * @param {Object} context
   * @param {string} context.tool - Tool name that was invoked
   * @param {Object} context.params - Tool parameters
   * @param {*} context.output - Tool output
   * @param {string} [context.agentId] - Agent that invoked the tool
   * @returns {{ output: *, transformations: Array<{ name: string, transformed: boolean }> }}
   */
  runPostToolUse(context) {
    const hooks = this._hooks.get('PostToolUse');
    let output = context.output;
    const transformations = [];

    for (const hook of hooks) {
      const result = hook.fn({ ...context, output });
      if (result.transformed && result.output !== undefined) {
        output = result.output;
      }
      transformations.push({
        name: hook.name,
        transformed: !!result.transformed,
      });
    }

    return { output, transformations };
  }

  /**
   * Execute EndOfTurn hooks. Purely observational — no return value used.
   *
   * @param {Object} context
   * @param {string} context.agentId - Agent that completed
   * @param {string} context.status - Completion status
   * @param {*} [context.result] - Agent result
   * @returns {{ executed: Array<string> }}
   */
  runEndOfTurn(context) {
    const hooks = this._hooks.get('EndOfTurn');
    const executed = [];

    for (const hook of hooks) {
      hook.fn(context);
      executed.push(hook.name);
    }

    return { executed };
  }

  /**
   * Clear all hooks for an event, or all events if none specified.
   *
   * @param {string} [event]
   */
  clear(event) {
    if (event) {
      if (this._hooks.has(event)) {
        this._hooks.set(event, []);
      }
    } else {
      for (const ev of HOOK_EVENTS) {
        this._hooks.set(ev, []);
      }
    }
  }
}

/**
 * Built-in Nyquist safety hook for PreToolUse.
 * Blocks tool invocations that involve dangerous shell commands.
 */
const nyquistSafetyHook = {
  name: 'nyquist-safety',
  priority: 0, // Always runs first
  fn(context) {
    // Only inspect tools that execute shell commands
    if (context.tool !== 'execute_command' && context.tool !== 'run_shell') {
      return { allow: true };
    }

    const command = context.params?.command || context.params?.cmd || '';
    if (!command) {
      return { allow: true, reason: 'No command to classify' };
    }

    const result = classifyCommand(command);

    if (result.classification === CLASSIFICATION.BLOCKED) {
      return { allow: false, reason: `Nyquist BLOCKED: ${result.reason}` };
    }

    if (result.classification === CLASSIFICATION.GUARDED) {
      // Guarded commands are allowed but flagged
      return { allow: true, reason: `Nyquist GUARDED: ${result.reason}` };
    }

    return { allow: true, reason: 'Nyquist SAFE' };
  },
};

/**
 * Create a HookRegistry pre-loaded with default safety hooks.
 *
 * @returns {HookRegistry}
 */
function createDefaultHooks() {
  const registry = new HookRegistry();
  registry.register('PreToolUse', nyquistSafetyHook);
  return registry;
}

module.exports = { HookRegistry, HOOK_EVENTS, createDefaultHooks, nyquistSafetyHook };
