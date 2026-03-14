#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { program } = require('commander');
const { parseRoadmap, buildDAG, formatPhasePlan, resolveRoadmapPath } = require('../lib/roadmap-parser');
const { AgentOrchestrator } = require('../lib/orchestrator');
const { createFileSystemRegistry } = require('../lib/mcp-registry');
const { classifyCommand, verifyCommands, scanCodeBlock } = require('../lib/nyquist');
const { ContextEngine } = require('../lib/context-engine');
const { createDefaultHooks } = require('../lib/hooks');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

const pkg = require('../package.json');

program
  .name('claude-suite')
  .description('Enterprise-grade orchestration for autonomous AI workflows.')
  .version(pkg.version);

// Core configuration resolution
function getInstallDir(isGlobal) {
  if (isGlobal) {
    return path.join(os.homedir(), '.claude-suite');
  }
  return path.join(process.cwd(), '.suite');
}

// ----------------------------------------------------------------------------
// Commands
// ----------------------------------------------------------------------------

program
  .command('install')
  .description('Install Claude Suite locally or globally')
  .option('-g, --global', 'Install globally')
  .option('-l, --local', 'Install locally')
  .action((options) => {
    const isGlobal = options.global || !options.local; // Default to global if not specified
    const targetDir = getInstallDir(isGlobal);

    console.log(`\n${cyan}Installing Claude Suite...${reset}`);
    console.log(`Target directory: ${targetDir}`);

    // Create target structure
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy workflows
    const workflowsSrc = path.join(__dirname, '..', 'workflows');
    const workflowsDest = path.join(targetDir, 'workflows');
    if (fs.existsSync(workflowsSrc)) {
      fs.cpSync(workflowsSrc, workflowsDest, { recursive: true });
    }

    // Copy templates
    const templatesSrc = path.join(__dirname, '..', 'templates');
    const templatesDest = path.join(targetDir, 'templates');
    if (fs.existsSync(templatesSrc)) {
      fs.cpSync(templatesSrc, templatesDest, { recursive: true });
    }

    console.log(`\n${green}✓ Installation complete!${reset}`);
    console.log(`\nRun ${cyan}claude-suite --help${reset} to see available commands.`);
  });

program
  .command('new-project')
  .description('Initialize a new project and generate PROJECT.md, ROADMAP.md, etc.')
  .option('--auto', 'Run in autonomous mode, bypassing interactive prompts')
  .action((options) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► INITIALIZING NEW PROJECT${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    const projectDir = path.join(process.cwd(), '.suite');

    // Check if project already exists
    if (fs.existsSync(projectDir)) {
      console.log(`${yellow}⚠ Project already initialized in .suite/${reset}`);
      return;
    }

    fs.mkdirSync(projectDir, { recursive: true });

    // In a full implementation, this would trigger the 'new-project.md' workflow via orchestrator
    // For now, we simulate the template copying
    const templatesDir = path.join(__dirname, '..', 'templates');

    if (fs.existsSync(templatesDir)) {
      fs.readdirSync(templatesDir).forEach(file => {
        fs.copyFileSync(path.join(templatesDir, file), path.join(projectDir, file));
        console.log(`Created ${path.join('.suite', file)}`);
      });
    } else {
       console.log(`${yellow}⚠ No templates found to scaffold.${reset}`);
    }

    console.log(`\n${green}✓ Project initialized.${reset}`);
  });

program
  .command('plan-phase <phase>')
  .description('Plan a specific phase defined in the roadmap')
  .option('--research', 'Perform domain research first')
  .option('--dag', 'Output the full DAG as JSON')
  .action((phase, options) => {
     const phaseIndex = parseInt(phase, 10);
     if (isNaN(phaseIndex)) {
       console.error(`${yellow}⚠ Phase must be a number (e.g., 0, 1, 2).${reset}`);
       process.exit(1);
     }

     console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
     console.log(`${cyan} CLAUDE SUITE ► PLANNING PHASE ${phase}${reset}`);
     console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

     const roadmapPath = resolveRoadmapPath(process.cwd());
     if (!roadmapPath) {
       console.error(`${yellow}⚠ No ROADMAP.md found. Run 'claude-suite new-project' first or place a ROADMAP.md in the working directory.${reset}`);
       process.exit(1);
     }

     console.log(`Reading roadmap: ${roadmapPath}`);

     const phases = parseRoadmap(roadmapPath);
     if (phases.length === 0) {
       console.error(`${yellow}⚠ No phases found in roadmap.${reset}`);
       process.exit(1);
     }

     const plan = formatPhasePlan(phases, phaseIndex);
     if (!plan) {
       console.error(`${yellow}⚠ Phase ${phaseIndex} not found in roadmap. Available phases: ${phases.map(p => p.index).join(', ')}${reset}`);
       process.exit(1);
     }

     console.log(`\n${plan}\n`);

     if (options.dag) {
       const dag = buildDAG(phases);
       console.log(`\n${cyan}DAG (JSON):${reset}`);
       console.log(JSON.stringify(dag, null, 2));
     }

     console.log(`\n${green}✓ Phase ${phase} planned.${reset}`);
  });

program
  .command('execute-phase <phase>')
  .description('Execute a planned phase using Wave Execution')
  .option('--dangerously-skip-permissions', 'Skip manual confirmations for destructive operations')
  .option('--concurrency <n>', 'Max parallel agents per wave', '4')
  .action(async (phase, options) => {
     const phaseIndex = parseInt(phase, 10);
     if (isNaN(phaseIndex)) {
       console.error(`${yellow}⚠ Phase must be a number (e.g., 0, 1, 2).${reset}`);
       process.exit(1);
     }

     console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
     console.log(`${cyan} CLAUDE SUITE ► EXECUTING PHASE ${phase}${reset}`);
     console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

     const roadmapPath = resolveRoadmapPath(process.cwd());
     if (!roadmapPath) {
       console.error(`${yellow}⚠ No ROADMAP.md found. Run 'claude-suite new-project' first.${reset}`);
       process.exit(1);
     }

     const phases = parseRoadmap(roadmapPath);
     const dag = buildDAG(phases);

     const suitePath = path.join(process.cwd(), '.suite');
     const orchestrator = new AgentOrchestrator({
       concurrency: parseInt(options.concurrency, 10),
       skipPermissions: options.dangerouslySkipPermissions || false,
       suitePath,
     });

     // Wire up event logging
     orchestrator.on('phase:start', ({ phase: p }) => {
       console.log(`${cyan}▶ Starting: ${p}${reset}`);
     });
     orchestrator.on('wave:start', ({ waveIndex, taskCount }) => {
       console.log(`${cyan}  Wave ${waveIndex}: launching ${taskCount} parallel agent(s)...${reset}`);
     });
     orchestrator.on('agent:start', ({ taskId, description }) => {
       console.log(`    [${taskId}] ${description}`);
     });
     orchestrator.on('agent:end', ({ taskId, exitCode }) => {
       const icon = exitCode === 0 ? `${green}✓${reset}` : `${yellow}✗${reset}`;
       console.log(`    ${icon} [${taskId}] exit ${exitCode}`);
     });
     orchestrator.on('wave:complete', ({ waveIndex }) => {
       console.log(`${green}  ✓ Wave ${waveIndex} complete.${reset}`);
     });
     orchestrator.on('wave:blocked', ({ waveIndex, failures }) => {
       console.error(`${yellow}  ✗ Wave ${waveIndex} blocked. ${failures.length} task(s) failed.${reset}`);
     });

     try {
       const wavePlan = orchestrator.planWaves(dag, phaseIndex);

       if (wavePlan.waves.length === 0) {
         console.log(`${green}✓ All tasks in Phase ${phase} are already complete.${reset}`);
         return;
       }

       console.log(`Planned ${wavePlan.waves.length} wave(s) with ${wavePlan.waves.reduce((n, w) => n + w.tasks.length, 0)} task(s).\n`);

       const results = await orchestrator.execute(wavePlan);

       console.log('');
       if (results.status === 'completed') {
         console.log(`${green}✓ Phase ${phase} complete.${reset}`);
       } else {
         console.log(`${yellow}⚠ Phase ${phase} blocked. Check STATE.md for details.${reset}`);
         process.exit(1);
       }
     } catch (err) {
       console.error(`${yellow}⚠ Execution error: ${err.message}${reset}`);
       process.exit(1);
     }
  });

program
  .command('mcp-tools')
  .description('List all registered MCP tool capabilities')
  .action(() => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► MCP TOOL REGISTRY${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    const registry = createFileSystemRegistry(process.cwd());
    const tools = registry.list();

    tools.forEach(tool => {
      const badge = tool.readOnly ? `${green}[read-only]${reset}` : `${yellow}[write]${reset}`;
      console.log(`  ${badge} ${cyan}${tool.name}${reset}`);
      console.log(`         ${tool.description}`);
    });

    console.log(`\n  Total: ${tools.length} tool(s) registered.\n`);
  });

program
  .command('verify <command...>')
  .description('Run Nyquist Layer verification on shell command(s)')
  .action((commands) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► NYQUIST VERIFICATION${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    const joined = commands.join(' ');
    const result = classifyCommand(joined);

    const colorMap = {
      safe: green,
      guarded: yellow,
      blocked: '\x1b[31m',
    };
    const color = colorMap[result.classification] || reset;

    console.log(`  Command:        ${joined}`);
    console.log(`  Classification: ${color}${result.classification.toUpperCase()}${reset}`);
    console.log(`  Reason:         ${result.reason}`);
    console.log('');

    if (result.classification === 'blocked') {
      process.exit(1);
    }
  });

program
  .command('context')
  .description('Manage the Context Engine (SQLite FTS5 knowledge store)')
  .option('--store <title>', 'Store a new fragment (reads content from stdin)')
  .option('--search <query>', 'Full-text search across stored fragments')
  .option('--list', 'List recent fragments')
  .option('--type <type>', 'Filter by fragment type (note, decision, snippet, research, error, plan)')
  .option('--phase <phase>', 'Filter by phase')
  .option('--limit <n>', 'Max results', '10')
  .action((options) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► CONTEXT ENGINE${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    const suitePath = path.join(process.cwd(), '.suite');
    const dbPath = path.join(suitePath, 'context.db');
    const engine = new ContextEngine(dbPath);
    const limit = parseInt(options.limit, 10) || 10;

    try {
      if (options.search) {
        const results = engine.search(options.search, {
          type: options.type,
          phase: options.phase,
          limit,
        });
        if (results.length === 0) {
          console.log(`  No results for "${options.search}"`);
        } else {
          results.forEach(r => {
            console.log(`  ${cyan}[${r.id}]${reset} ${r.title} ${yellow}(${r.type})${reset}`);
            console.log(`       ${r.content.substring(0, 120)}${r.content.length > 120 ? '...' : ''}`);
            console.log('');
          });
          console.log(`  ${results.length} result(s).`);
        }
      } else if (options.list) {
        const results = engine.list({
          type: options.type,
          phase: options.phase,
          limit,
        });
        if (results.length === 0) {
          console.log('  No fragments stored yet.');
        } else {
          results.forEach(r => {
            console.log(`  ${cyan}[${r.id}]${reset} ${r.title} ${yellow}(${r.type})${reset} — ${r.created_at}`);
          });
          console.log(`\n  ${engine.count()} total fragment(s).`);
        }
      } else if (options.store) {
        // Store mode: title from flag, content from remaining args or a default
        const content = process.argv.slice(process.argv.indexOf(options.store) + 1).join(' ') || options.store;
        engine.store({
          source: 'cli',
          type: options.type || 'note',
          phase: options.phase || null,
          title: options.store,
          content,
        });
        console.log(`  ${green}✓ Fragment stored.${reset}`);
      } else {
        console.log(`  Use --search, --list, or --store. See --help for details.`);
      }
    } finally {
      engine.close();
    }
    console.log('');
  });

program
  .command('hooks')
  .description('List registered lifecycle hooks (PreToolUse, PostToolUse, EndOfTurn)')
  .action(() => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► HOOK REGISTRY${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    const registry = createDefaultHooks();
    const events = ['PreToolUse', 'PostToolUse', 'EndOfTurn'];

    events.forEach(event => {
      const hooks = registry.list(event);
      console.log(`  ${cyan}${event}${reset} (${hooks.length} hook${hooks.length !== 1 ? 's' : ''}):`);
      if (hooks.length === 0) {
        console.log(`    ${yellow}(none)${reset}`);
      } else {
        hooks.forEach(h => {
          console.log(`    [priority ${h.priority}] ${h.name}`);
        });
      }
      console.log('');
    });
  });

// Execute
program.parse(process.argv);
