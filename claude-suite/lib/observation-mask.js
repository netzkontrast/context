'use strict';

/**
 * Observation Mask — Post-execution context compression hook.
 *
 * Based on JetBrains Research "The Complexity Trap" (NeurIPS 2025):
 * 83.9% of context bloat comes from tool output observations.
 * Simply replacing old tool outputs with "[Output Omitted]" placeholders
 * halves token cost and matches or beats LLM-based summarization.
 *
 * This module provides functions to mask old tool outputs in conversation
 * history while preserving the agent's reasoning trace and action history.
 *
 * Strategy:
 *   - Keep the last N tool outputs verbatim (they're likely still relevant)
 *   - Replace older tool outputs with a compact placeholder
 *   - Never mask the agent's own reasoning or decisions
 *   - Optionally keep a 1-line summary of masked outputs
 */

const DEFAULT_KEEP_RECENT = 5; // Keep the 5 most recent tool outputs verbatim
const MAX_SUMMARY_LENGTH = 120; // Max chars for a masked output summary

/**
 * Mask tool outputs in a conversation history array.
 *
 * @param {Array} messages - Array of {role, content, toolOutput?} messages
 * @param {object} options
 * @param {number} options.keepRecent - Number of recent tool outputs to preserve
 * @param {boolean} options.summarize - Include 1-line summary of masked content
 * @returns {Array} Messages with old tool outputs replaced by placeholders
 */
function maskObservations(messages, options = {}) {
  const keepRecent = options.keepRecent ?? DEFAULT_KEEP_RECENT;
  const summarize = options.summarize ?? true;

  // Find indices of all tool output messages
  const toolOutputIndices = [];
  for (let i = 0; i < messages.length; i++) {
    if (isToolOutput(messages[i])) {
      toolOutputIndices.push(i);
    }
  }

  // Determine which outputs to mask (all except the most recent N)
  const maskCount = Math.max(0, toolOutputIndices.length - keepRecent);
  const indicesToMask = new Set(toolOutputIndices.slice(0, maskCount));

  // Build masked message array
  return messages.map((msg, i) => {
    if (!indicesToMask.has(i)) return msg;

    const placeholder = buildPlaceholder(msg, summarize);
    return {
      ...msg,
      content: placeholder,
      _masked: true,
      _originalLength: getContentLength(msg),
    };
  });
}

/**
 * Check if a message represents a tool output/observation.
 */
function isToolOutput(message) {
  if (message.role === 'tool') return true;
  if (message.toolOutput) return true;
  if (message.type === 'tool_result') return true;
  // Heuristic: large content from system/assistant that looks like output
  if (message.role === 'system' && getContentLength(message) > 500) return true;
  return false;
}

/**
 * Build a compact placeholder for a masked tool output.
 */
function buildPlaceholder(message, includeSummary) {
  const length = getContentLength(message);
  const tokenEstimate = Math.ceil(length / 4);

  let placeholder = `[Output masked — ${tokenEstimate} tokens omitted]`;

  if (includeSummary) {
    const summary = extractSummary(message);
    if (summary) {
      placeholder += `\n[Summary: ${summary}]`;
    }
  }

  return placeholder;
}

/**
 * Extract a 1-line summary from tool output content.
 * Uses heuristics: first non-empty line, or first line containing key info.
 */
function extractSummary(message) {
  const content = typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content);

  if (!content) return null;

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;

  // Try to find the most informative first line
  let summary = lines[0].trim();

  // If first line is generic (like a file path or delimiter), try the next
  if (summary.length < 10 && lines.length > 1) {
    summary = lines[1].trim();
  }

  // Truncate to max length
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
  }

  return summary;
}

/**
 * Get the character length of a message's content.
 */
function getContentLength(message) {
  if (typeof message.content === 'string') return message.content.length;
  if (typeof message.content === 'object') return JSON.stringify(message.content).length;
  return 0;
}

/**
 * Calculate compression stats for a masked conversation.
 */
function compressionStats(original, masked) {
  const originalTokens = original.reduce((sum, m) => sum + Math.ceil(getContentLength(m) / 4), 0);
  const maskedTokens = masked.reduce((sum, m) => sum + Math.ceil(getContentLength(m) / 4), 0);
  const maskedCount = masked.filter(m => m._masked).length;

  return {
    originalTokens,
    maskedTokens,
    savedTokens: originalTokens - maskedTokens,
    compressionRatio: originalTokens > 0 ? (1 - maskedTokens / originalTokens).toFixed(2) : 0,
    messagesMasked: maskedCount,
    messagesTotal: original.length,
  };
}

module.exports = {
  maskObservations,
  compressionStats,
  isToolOutput,
  extractSummary,
};
