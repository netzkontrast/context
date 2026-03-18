#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { program } = require('commander');
const { parseRoadmap, buildDAG, formatPhasePlan, resolveRoadmapPath } = require('../lib/roadmap-parser');
const { AgentOrchestrator } = require('../lib/orchestrator');
const { createFileSystemRegistry } = require('../lib/mcp-registry');
const { classifyCommand, verifyCommands, scanCodeBlock } = require('../lib/nyquist');

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

// ---------------------------------------------------------------------------
// Phase 5: Context Store & Telemetry Commands
// ---------------------------------------------------------------------------

program
  .command('search <query>')
  .description('Full-text search across all project context (SQLite FTS5)')
  .option('-s, --session <id>', 'Limit search to a specific session')
  .option('-l, --limit <n>', 'Max results', '20')
  .action((query, options) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► CONTEXT SEARCH${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    let ContextStore;
    try {
      ContextStore = require('../lib/context-store').ContextStore;
    } catch (err) {
      console.error(`${yellow}⚠ Context store not available. Run 'npm install better-sqlite3' in the claude-suite directory.${reset}`);
      process.exit(1);
    }

    const dbPath = path.join(process.cwd(), '.suite', 'context.db');
    if (!fs.existsSync(dbPath)) {
      console.error(`${yellow}⚠ No context database found. Execute a phase first to populate context.${reset}`);
      process.exit(1);
    }

    const store = new ContextStore({ dbPath });
    const limit = parseInt(options.limit, 10) || 20;
    const results = options.session
      ? store.searchInSession(options.session, query, limit)
      : store.search(query, limit);

    if (results.length === 0) {
      console.log(`  No results for "${query}".`);
    } else {
      results.forEach((r, i) => {
        console.log(`  ${cyan}${i + 1}.${reset} [${r.key}] (session: ${r.session_id})`);
        const preview = r.content.substring(0, 120).replace(/\n/g, ' ');
        console.log(`     ${preview}${r.content.length > 120 ? '...' : ''}`);
      });
      console.log(`\n  ${results.length} result(s) found.\n`);
    }

    store.close();
  });

program
  .command('replay <session>')
  .description('Replay execution history for a session from telemetry logs')
  .action((session) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► SESSION REPLAY${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    let Telemetry;
    try {
      Telemetry = require('../lib/telemetry').Telemetry;
    } catch (err) {
      console.error(`${yellow}⚠ Telemetry module not available.${reset}`);
      process.exit(1);
    }

    const logDir = path.join(process.cwd(), '.suite', 'telemetry');
    if (!fs.existsSync(logDir)) {
      console.error(`${yellow}⚠ No telemetry logs found. Execute a phase first.${reset}`);
      process.exit(1);
    }

    const telemetry = new Telemetry({ logDir });
    const events = telemetry.readSessionLogs(session);
    telemetry.close();

    if (events.length === 0) {
      console.log(`  No events found for session "${session}".`);
      return;
    }

    console.log(`  Replaying ${events.length} event(s) for session ${cyan}${session}${reset}:\n`);

    const colorMap = {
      'phase:start': cyan,
      'phase:end': green,
      'wave:start': cyan,
      'wave:complete': green,
      'agent:spawn': yellow,
      'agent:complete': green,
      'agent:fail': '\x1b[31m',
      'nyquist:classify': '\x1b[35m',
    };

    events.forEach((e) => {
      const color = colorMap[e.type] || reset;
      const time = e.timestamp ? e.timestamp.substring(11, 19) : '??:??:??';
      const detail = Object.entries(e)
        .filter(([k]) => !['type', 'timestamp', 'sessionId'].includes(k))
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      console.log(`  ${time} ${color}${e.type}${reset} ${detail}`);
    });

    console.log('');
  });

program
  .command('sessions')
  .description('List all execution sessions')
  .option('-s, --status <status>', 'Filter by status (active, completed, failed)')
  .action((options) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► SESSIONS${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    let ContextStore;
    try {
      ContextStore = require('../lib/context-store').ContextStore;
    } catch (err) {
      console.error(`${yellow}⚠ Context store not available. Run 'npm install better-sqlite3' in the claude-suite directory.${reset}`);
      process.exit(1);
    }

    const dbPath = path.join(process.cwd(), '.suite', 'context.db');
    if (!fs.existsSync(dbPath)) {
      console.error(`${yellow}⚠ No context database found.${reset}`);
      process.exit(1);
    }

    const store = new ContextStore({ dbPath });
    const sessions = options.status ? store.listSessions(options.status) : store.listSessions();

    if (sessions.length === 0) {
      console.log('  No sessions found.');
    } else {
      sessions.forEach((s) => {
        const statusColor = s.status === 'completed' ? green : s.status === 'failed' ? '\x1b[31m' : yellow;
        console.log(`  ${cyan}${s.id}${reset}  phase=${s.phase}  ${statusColor}${s.status}${reset}  ${s.created_at}`);
      });
      console.log(`\n  ${sessions.length} session(s) total.\n`);
    }

    store.close();
  });

program
  .command('budget [session]')
  .description('Estimate token budget for a session\'s context')
  .action((session) => {
    console.log(`\n${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
    console.log(`${cyan} CLAUDE SUITE ► TOKEN BUDGET${reset}`);
    console.log(`${cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);

    let ContextStore;
    try {
      ContextStore = require('../lib/context-store').ContextStore;
    } catch (err) {
      console.error(`${yellow}⚠ Context store not available.${reset}`);
      process.exit(1);
    }

    const dbPath = path.join(process.cwd(), '.suite', 'context.db');
    if (!fs.existsSync(dbPath)) {
      console.error(`${yellow}⚠ No context database found.${reset}`);
      process.exit(1);
    }

    const store = new ContextStore({ dbPath });

    if (session) {
      const budget = store.getSessionTokenBudget(session);
      console.log(`  Session: ${cyan}${session}${reset}`);
      console.log(`  Total estimated tokens: ${yellow}${budget.totalTokens.toLocaleString()}${reset}\n`);
      Object.entries(budget.breakdown).forEach(([key, tokens]) => {
        console.log(`    ${key}: ${tokens.toLocaleString()} tokens`);
      });
    } else {
      const sessions = store.listSessions();
      if (sessions.length === 0) {
        console.log('  No sessions found.');
      } else {
        sessions.forEach((s) => {
          const budget = store.getSessionTokenBudget(s.id);
          console.log(`  ${cyan}${s.id}${reset}  ~${yellow}${budget.totalTokens.toLocaleString()}${reset} tokens`);
        });
      }
    }

    console.log('');
    store.close();
  });

// Execute
program.parse(process.argv);
