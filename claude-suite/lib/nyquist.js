'use strict';

/**
 * Nyquist Layer — Command & Code Verification
 *
 * Named after the Nyquist sampling theorem: you must inspect at twice the
 * "frequency" of potential harm to catch destructive operations reliably.
 *
 * This module provides AST-like static analysis of shell commands and code
 * blocks before they are executed by agents. It classifies operations as:
 *   - SAFE:    Read-only, no side effects (auto-approved)
 *   - GUARDED: Write operations within sandbox (require permission unless --dangerously-skip-permissions)
 *   - BLOCKED: Destructive or out-of-sandbox operations (always rejected)
 *
 * Inspired by the Dippy tool (see sources.md) for AST-based shell scanning.
 */

const CLASSIFICATION = {
  SAFE: 'safe',
  GUARDED: 'guarded',
  BLOCKED: 'blocked',
};

// Commands that are always safe (read-only)
const SAFE_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'echo', 'pwd', 'whoami', 'date',
  'wc', 'sort', 'uniq', 'grep', 'find', 'which', 'type', 'file',
  'diff', 'stat', 'du', 'df', 'tree', 'realpath', 'basename', 'dirname',
  'env', 'printenv', 'uname', 'id', 'test', 'true', 'false',
  'node', 'python', 'python3', 'npm', 'npx', 'git',
]);

// Patterns that are always blocked
const BLOCKED_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b/,  // rm -rf variants
  /\brm\s+-rf?\s+[\/~]/,                  // rm targeting root or home
  /\bsudo\b/,                              // privilege escalation
  /\bchmod\s+777\b/,                       // world-writable
  /\bchown\b/,                             // ownership changes
  /\bmkfs\b/,                              // filesystem creation
  /\bdd\s+/,                               // raw disk operations
  /\b(curl|wget)\s+.*\|\s*(ba)?sh\b/,     // pipe-to-shell
  /\beval\s/,                              // eval of dynamic strings
  />\s*\/dev\/sd/,                         // writing to block devices
  /\b(shutdown|reboot|halt|poweroff)\b/,   // system control
  /\bnc\s+-[a-zA-Z]*l/,                   // netcat listeners
  /\biptables\b/,                          // firewall changes
  /\bsystemctl\s+(stop|disable|mask)\b/,  // service disruption
];

// Patterns that require permission (write operations)
const GUARDED_PATTERNS = [
  /\brm\b/,                     // any file deletion
  /\bmv\b/,                     // file moves/renames
  /\bcp\b/,                     // file copies
  /\bmkdir\b/,                  // directory creation
  /\btouch\b/,                  // file creation
  /\bgit\s+(push|commit|reset|checkout|merge|rebase)\b/,
  /\bnpm\s+(install|uninstall|publish)\b/,
  /\b(curl|wget)\s/,           // network requests
  />\s/,                        // output redirection
  /\|\s*tee\b/,                // tee (writes files)
];

/**
 * Tokenize a shell command string into a simple AST-like structure.
 * Handles pipes, semicolons, and && chains.
 */
function tokenize(command) {
  const segments = [];
  // Split on pipe, semicolon, &&, ||
  const parts = command.split(/\s*(?:\|\||&&|[;|])\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(/\s+/);
    const cmd = tokens[0];
    const args = tokens.slice(1);

    segments.push({
      raw: trimmed,
      command: cmd,
      args,
    });
  }

  return segments;
}

/**
 * Classify a single shell command string.
 * Returns { classification, command, reason }
 */
function classifyCommand(commandStr) {
  const trimmed = commandStr.trim();
  if (!trimmed) {
    return { classification: CLASSIFICATION.SAFE, command: trimmed, reason: 'empty command' };
  }

  // Check blocked patterns first (highest priority)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        classification: CLASSIFICATION.BLOCKED,
        command: trimmed,
        reason: `Matches blocked pattern: ${pattern}`,
      };
    }
  }

  // Check guarded patterns
  for (const pattern of GUARDED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        classification: CLASSIFICATION.GUARDED,
        command: trimmed,
        reason: `Matches guarded pattern: ${pattern}`,
      };
    }
  }

  // Tokenize and check individual commands
  const segments = tokenize(trimmed);
  for (const seg of segments) {
    if (!SAFE_COMMANDS.has(seg.command)) {
      return {
        classification: CLASSIFICATION.GUARDED,
        command: trimmed,
        reason: `Unknown command: ${seg.command}`,
      };
    }
  }

  return {
    classification: CLASSIFICATION.SAFE,
    command: trimmed,
    reason: 'All commands are in the safe list',
  };
}

/**
 * Verify a batch of commands. Returns a summary with pass/fail.
 */
function verifyCommands(commands) {
  const results = commands.map(cmd => classifyCommand(cmd));
  const blocked = results.filter(r => r.classification === CLASSIFICATION.BLOCKED);
  const guarded = results.filter(r => r.classification === CLASSIFICATION.GUARDED);
  const safe = results.filter(r => r.classification === CLASSIFICATION.SAFE);

  return {
    passed: blocked.length === 0,
    summary: {
      total: results.length,
      safe: safe.length,
      guarded: guarded.length,
      blocked: blocked.length,
    },
    results,
  };
}

/**
 * Scan a code block (string) for embedded shell commands.
 * Extracts lines that look like shell invocations.
 */
function scanCodeBlock(code) {
  const lines = code.split('\n');
  const shellLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments, empty lines, and pure assignment
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    // Match lines that start with common shell patterns
    if (/^(\$\s+)?[a-zA-Z_\/.]/.test(trimmed)) {
      // Strip leading $ prompt
      const cleaned = trimmed.replace(/^\$\s+/, '');
      shellLines.push(cleaned);
    }
  }

  return verifyCommands(shellLines);
}

module.exports = {
  CLASSIFICATION,
  classifyCommand,
  verifyCommands,
  scanCodeBlock,
  tokenize,
};
