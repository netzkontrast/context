'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse a SKILL.md file's YAML front-matter block.
 *
 * Supports the subset of YAML used by claude-suite skill manifests:
 *   - Scalar string values: `key: value`
 *   - Block scalars (folded `>`): single-line only
 *   - Lists: `key:\n  - item`
 *   - Nested objects: `metadata:\n  version: "1.0.0"`
 *
 * @param {string} content  Raw file content of a SKILL.md
 * @returns {{ name: string, description: string, allowedTools: string[], metadata: object, body: string }}
 */
function parseSkillManifest(content) {
  const result = {
    name: '',
    description: '',
    allowedTools: [],
    metadata: {},
    body: '',
  };

  if (typeof content !== 'string') return result;

  // Split on front-matter delimiters: --- at the very start and a closing ---
  const parts = content.split(/^---\s*$/m);
  // parts[0] is empty (before opening ---), parts[1] is front-matter, parts[2]+ is body
  if (parts.length < 3) {
    result.body = content.trim();
    return result;
  }

  const frontMatter = parts[1];
  result.body = parts.slice(2).join('---').trim();

  const lines = frontMatter.split('\n');
  let currentKey = null;
  let inList = false;
  let inMetadata = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Skip blank lines
    if (!line.trim()) {
      currentKey = null;
      inList = false;
      continue;
    }

    // Nested metadata value: `  key: value` (2-space indent, inside metadata block)
    if (inMetadata && /^  \w/.test(line)) {
      const metaMatch = line.match(/^\s+([\w-]+):\s*"?([^"]*)"?\s*$/);
      if (metaMatch) {
        const [, k, v] = metaMatch;
        result.metadata[k] = v;
      }
      continue;
    }

    // List item: `  - value`
    if (inList && /^  - /.test(line)) {
      const item = line.replace(/^  - /, '').trim();
      if (currentKey === 'allowed-tools') {
        result.allowedTools.push(item);
      }
      continue;
    }

    // Top-level key: `key: value` or `key:` (start of block)
    const keyMatch = line.match(/^([\w-]+):\s*(.*)?$/);
    if (keyMatch) {
      const [, key, val] = keyMatch;
      const value = (val || '').trim().replace(/^>$/, '').trim();

      inList = false;
      inMetadata = false;
      currentKey = key;

      if (key === 'name') {
        result.name = value;
      } else if (key === 'description') {
        // description may be a folded scalar — value is empty if block follows
        result.description = value || '';
      } else if (key === 'allowed-tools') {
        inList = true;
      } else if (key === 'metadata') {
        inMetadata = true;
      }
      continue;
    }

    // Continuation of a description block scalar (indented text)
    if (currentKey === 'description' && /^\s+\S/.test(line)) {
      result.description += (result.description ? ' ' : '') + line.trim();
    }
  }

  return result;
}

/**
 * Discover all SKILL.md files under .claude-skills-NAME/ directories.
 *
 * @param {string} baseDir  Root directory to search
 * @returns {string[]}  Paths to discovered SKILL.md files
 */
function discoverSkills(baseDir) {
  const found = [];
  if (typeof baseDir !== 'string') return found;

  let entries;
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('.claude-skills-')) continue;

    const skillMd = path.join(baseDir, entry.name, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      found.push(skillMd);
    }
  }

  return found;
}

/**
 * Load a single skill from a SKILL.md path.
 *
 * @param {string} skillMdPath  Absolute path to a SKILL.md file
 * @returns {{ manifest: object, dir: string, scripts: string[] }}
 */
function loadSkill(skillMdPath) {
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const manifest = parseSkillManifest(content);
  const dir = path.dirname(skillMdPath);

  // Optionally discover scripts
  const scriptsDir = path.join(dir, 'scripts');
  let scripts = [];
  try {
    scripts = fs.readdirSync(scriptsDir).filter(f => !f.startsWith('.'));
  } catch { /* scripts dir is optional */ }

  return { manifest, dir, scripts };
}

/**
 * SkillLoader — discovers and provides access to claude-suite skills.
 *
 * Usage:
 *   const loader = new SkillLoader('/path/to/project');
 *   loader.discover();
 *   const skill = loader.get('dev');
 */
class SkillLoader {
  constructor(baseDir) {
    this.baseDir = baseDir || process.cwd();
    this._skills = new Map(); // name → loaded skill
  }

  /**
   * Scan baseDir for .claude-skills-NAME/ directories and load their manifests.
   * @returns {number} Count of skills discovered
   */
  discover() {
    this._skills.clear();
    const paths = discoverSkills(this.baseDir);

    for (const skillMdPath of paths) {
      try {
        const skill = loadSkill(skillMdPath);
        const name = skill.manifest.name || path.basename(path.dirname(skillMdPath)).replace('.claude-skills-', '');
        this._skills.set(name, skill);
      } catch {
        // Skip unreadable skills — graceful degradation
      }
    }

    return this._skills.size;
  }

  /**
   * Return all loaded skills as an array.
   * @returns {Array<{ name: string, manifest: object, dir: string, scripts: string[] }>}
   */
  list() {
    return Array.from(this._skills.entries()).map(([name, skill]) => ({
      name,
      ...skill,
    }));
  }

  /**
   * Get a skill by name. Returns undefined if not found.
   * @param {string} name
   * @returns {{ manifest: object, dir: string, scripts: string[] } | undefined}
   */
  get(name) {
    return this._skills.get(name);
  }
}

module.exports = { SkillLoader, discoverSkills, parseSkillManifest, loadSkill };
