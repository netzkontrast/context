'use strict';

const fs = require('fs');
const path = require('path');

/**
 * MCP Capability Registry
 *
 * Provides a standardized interface for tool capabilities that agents can invoke.
 * Each capability is registered with a name, description, parameter schema, and
 * handler function. The registry enforces the Model Context Protocol pattern:
 * tools are declared upfront so the LLM knows what's available without probing.
 *
 * Usage:
 *   const registry = new MCPRegistry();
 *   registry.register({ name: 'read_file', ... });
 *   const result = await registry.invoke('read_file', { path: './foo.txt' });
 */
class MCPRegistry {
  constructor() {
    this._tools = new Map();
  }

  register(tool) {
    if (!tool.name || !tool.handler) {
      throw new Error('MCP tool must have a name and handler');
    }
    this._tools.set(tool.name, {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || {},
      handler: tool.handler,
      readOnly: tool.readOnly !== undefined ? tool.readOnly : false,
    });
  }

  get(name) {
    return this._tools.get(name) || null;
  }

  list() {
    return Array.from(this._tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      readOnly: t.readOnly,
    }));
  }

  async invoke(name, params = {}) {
    const tool = this._tools.get(name);
    if (!tool) {
      throw new Error(`MCP tool not found: ${name}`);
    }
    return tool.handler(params);
  }
}

/**
 * Create a registry pre-loaded with standard file system capabilities.
 * These are the safe, sandboxed operations agents can use.
 */
function createFileSystemRegistry(basePath) {
  const registry = new MCPRegistry();

  // Resolve and validate that a path stays within the sandbox
  function safePath(relativePath) {
    const resolved = path.resolve(basePath, relativePath);
    if (!resolved.startsWith(path.resolve(basePath))) {
      throw new Error(`Path escapes sandbox: ${relativePath}`);
    }
    return resolved;
  }

  registry.register({
    name: 'read_file',
    description: 'Read the contents of a file within the project.',
    parameters: { path: 'string (relative to project root)' },
    readOnly: true,
    handler: ({ path: filePath }) => {
      const resolved = safePath(filePath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`File not found: ${filePath}`);
      }
      return fs.readFileSync(resolved, 'utf-8');
    },
  });

  registry.register({
    name: 'write_file',
    description: 'Write content to a file within the project.',
    parameters: { path: 'string', content: 'string' },
    readOnly: false,
    handler: ({ path: filePath, content }) => {
      const resolved = safePath(filePath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf-8');
      return { written: resolved, bytes: Buffer.byteLength(content, 'utf-8') };
    },
  });

  registry.register({
    name: 'list_directory',
    description: 'List files and directories at a given path.',
    parameters: { path: 'string (relative, defaults to ".")' },
    readOnly: true,
    handler: ({ path: dirPath = '.' }) => {
      const resolved = safePath(dirPath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
    },
  });

  registry.register({
    name: 'file_exists',
    description: 'Check if a file or directory exists.',
    parameters: { path: 'string' },
    readOnly: true,
    handler: ({ path: filePath }) => {
      const resolved = safePath(filePath);
      return { exists: fs.existsSync(resolved) };
    },
  });

  registry.register({
    name: 'delete_file',
    description: 'Delete a file within the project. Requires permission.',
    parameters: { path: 'string' },
    readOnly: false,
    handler: ({ path: filePath }) => {
      const resolved = safePath(filePath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`File not found: ${filePath}`);
      }
      fs.unlinkSync(resolved);
      return { deleted: filePath };
    },
  });

  registry.register({
    name: 'append_file',
    description: 'Append content to an existing file.',
    parameters: { path: 'string', content: 'string' },
    readOnly: false,
    handler: ({ path: filePath, content }) => {
      const resolved = safePath(filePath);
      fs.appendFileSync(resolved, content, 'utf-8');
      return { appended: filePath, bytes: Buffer.byteLength(content, 'utf-8') };
    },
  });

  return registry;
}

module.exports = { MCPRegistry, createFileSystemRegistry };
