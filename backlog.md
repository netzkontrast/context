# Backlog

*Deferred requirements and future ideas. Items move to planning.md when scheduled.*

## Scheduled (See planning.md for execution waves)
- ~~SQLite FTS5 context store~~ → Phase 5
- ~~JSONL telemetry logging~~ → Phase 5
- ~~Agent persona ecosystem~~ → Phase 6
- ~~OS-level hooks (PreToolUse, PostToolUse)~~ → Phase 7
- ~~Parry/Dippy security integrations~~ → Phase 7

## Unscheduled Requirements
- **Zod schema migration**: Evaluate replacing custom TruthVerifier JSON schema subset with Zod for TypeScript migration path. Decision: deferred until TypeScript migration is considered.
- **Property-based testing**: Generative test cases for agent output schemas. Scheduled tentatively in Phase 6 Wave 4.
- **Multi-model support**: Support for non-Claude models (GPT-4, Gemini) as agent backends via adapter pattern.
- **Web dashboard**: Real-time visualization of wave execution, agent status, and telemetry. Electron or browser-based.
- **Plugin system**: Third-party skill/tool packages installable via npm.
- **Container isolation**: Run agents in Docker containers instead of subprocesses for stronger isolation.

## Python Implementation Ideas (Deferred)
- **Framework:** Python Typer for interactive CLI handling.
- **Validation:** Pydantic for rigid LLM output schema validation via instructor.
- **Why deferred:** Node.js fits the `npx` global install footprint more natively. Revisit when/if Python ecosystem demand materializes.

## Advanced Orchestration Ideas (Phase 9+)
- **Byzantine Fault Tolerance**: Quorum voting for high-stakes code changes (3 agents must agree).
- **Q-Learning Routing**: Pre-classify queries to assign optimal agent persona without LLM router latency.
- **Code Digital Twins**: Shadow execution environment mirroring production for pre-validation.
- **Multi-repo orchestration**: Single suite instance managing multiple repositories with shared context.
- **Adaptive concurrency**: Auto-tune parallel agent count based on system resources and task complexity.

## Integration Ideas (Phase 8+)
- Slack approval flows for guarded operations.
- Jira ticket sync from REQUIREMENTS.md (REQ-IDs to Jira issues).
- GitHub Actions CI/CD pipeline with test gates.
- Webhook notifications for phase completion events.
- VS Code extension for in-editor wave execution monitoring.

## High-Coherence Agentic Frameworks (Software 3.0)
- **Advanced Paraconsistent Logic Handlers:** Formalize the integration of neuro-symbolic methods to evaluate conflicting constraints, allowing the system to isolate and flag paradoxical code or API documentation without triggering catastrophic reasoning failure.
- **Integrated Information Theory ($\Phi$) Metrics:** Implement live computational metrology based on IIT and the Free Energy Principle (FEP-AI) to actively monitor the spatial, temporal, and causal coherence of the multi-agent swarm, providing an early-warning telemetry metric for context rot.
- **TSDP-Based "Experience Replay" Training:** Design self-healing "therapy" loops for models experiencing Second-Order Learning (dissociative) failures, utilizing balanced ratios of trauma examples and safe examples to update meta-weights without catastrophic forgetting.
- **Narrative Context Protocol (NCP) Sandbox:** Integrate the Dramatica Storyform structure for expansive, non-contradictory narrative workflows, supporting Storyforming, Story Encoding, and Storyweaving agents.
