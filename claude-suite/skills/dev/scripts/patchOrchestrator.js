const fs = require('fs');

const orchCode = fs.readFileSync('claude-suite/lib/orchestrator.js', 'utf8');

let newCode = orchCode;

// Inject ContextStore and Telemetry into constructor if not already there
if (!newCode.includes('const { ContextStore } = require(')) {
  newCode = `const { ContextStore } = require('./context-store');\nconst { Telemetry } = require('./telemetry');\n` + newCode;
}

// Modify constructor to accept and instantiate contextStore and telemetry if needed
// Actually, looking at the truncated code earlier, it seems `this._contextStore` and `this._telemetry` are already used in `executePhase` and `_executeWave`.
// Let's check the constructor exactly.
