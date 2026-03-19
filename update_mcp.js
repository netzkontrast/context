const fs = require('fs');

const mcpRegistryCode = fs.readFileSync('claude-suite/lib/mcp-registry.js', 'utf8');

const newMethods = `
/**
 * Add context store and telemetry tools to the registry
 */
function createExtendedRegistry(basePath, contextStore, telemetry) {
  const registry = createFileSystemRegistry(basePath);

  if (contextStore) {
    registry.register({
      name: 'read_context',
      description: 'Read a snapshot from the SQLite context store.',
      parameters: { sessionId: 'string', key: 'string' },
      readOnly: true,
      handler: ({ sessionId, key }) => {
        const snap = contextStore.getSnapshot(sessionId, key);
        if (!snap) throw new Error(\`Context snapshot not found: \${key}\`);
        return snap.content;
      },
    });

    registry.register({
      name: 'write_context',
      description: 'Write a new snapshot to the SQLite context store.',
      parameters: { sessionId: 'string', key: 'string', content: 'string' },
      readOnly: false,
      handler: ({ sessionId, key, content }) => {
        contextStore.saveSnapshot(sessionId, key, content);
        return { success: true, key };
      },
    });

    registry.register({
      name: 'search_context',
      description: 'Search across all context snapshots using full-text search.',
      parameters: { query: 'string', limit: 'number (optional)' },
      readOnly: true,
      handler: ({ query, limit = 10 }) => {
        return contextStore.search(query, limit);
      },
    });
  }

  if (telemetry) {
    registry.register({
      name: 'log_telemetry',
      description: 'Log a custom event to the telemetry JSONL stream.',
      parameters: { eventType: 'string', payload: 'object' },
      readOnly: false,
      handler: ({ eventType, payload }) => {
        telemetry.emit({ type: \`custom:\${eventType}\`, ...payload });
        return { success: true };
      },
    });
  }

  return registry;
}

module.exports = { MCPRegistry, createFileSystemRegistry, createExtendedRegistry };
`;

const updatedCode = mcpRegistryCode.replace('module.exports = { MCPRegistry, createFileSystemRegistry };', newMethods);
fs.writeFileSync('claude-suite/lib/mcp-registry.js', updatedCode, 'utf8');

console.log("mcp-registry.js updated!");
