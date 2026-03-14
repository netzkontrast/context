'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { HookRegistry, HOOK_EVENTS, createDefaultHooks, nyquistSafetyHook } = require('../lib/hooks');

describe('HookRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe('register()', () => {
    it('registers a hook handler for a valid event', () => {
      registry.register('PreToolUse', {
        name: 'test-hook',
        fn: () => ({ allow: true }),
      });
      const hooks = registry.list('PreToolUse');
      assert.equal(hooks.length, 1);
      assert.equal(hooks[0].name, 'test-hook');
    });

    it('rejects invalid event names', () => {
      assert.throws(() => {
        registry.register('InvalidEvent', { name: 'bad', fn: () => {} });
      }, /Invalid hook event/);
    });

    it('rejects handlers without name or fn', () => {
      assert.throws(() => {
        registry.register('PreToolUse', { fn: () => {} });
      }, /requires name and fn/);

      assert.throws(() => {
        registry.register('PreToolUse', { name: 'no-fn' });
      }, /requires name and fn/);
    });

    it('replaces handler with same name', () => {
      registry.register('PreToolUse', { name: 'dup', fn: () => ({ allow: true }) });
      registry.register('PreToolUse', { name: 'dup', fn: () => ({ allow: false }) });
      assert.equal(registry.list('PreToolUse').length, 1);
    });

    it('sorts hooks by priority', () => {
      registry.register('PreToolUse', { name: 'low', priority: 200, fn: () => ({ allow: true }) });
      registry.register('PreToolUse', { name: 'high', priority: 10, fn: () => ({ allow: true }) });
      registry.register('PreToolUse', { name: 'mid', priority: 100, fn: () => ({ allow: true }) });

      const hooks = registry.list('PreToolUse');
      assert.equal(hooks[0].name, 'high');
      assert.equal(hooks[1].name, 'mid');
      assert.equal(hooks[2].name, 'low');
    });

    it('defaults priority to 100', () => {
      registry.register('PreToolUse', { name: 'default', fn: () => ({ allow: true }) });
      assert.equal(registry.list('PreToolUse')[0].priority, 100);
    });
  });

  describe('unregister()', () => {
    it('removes a registered hook', () => {
      registry.register('PreToolUse', { name: 'removeme', fn: () => ({}) });
      assert.equal(registry.unregister('PreToolUse', 'removeme'), true);
      assert.equal(registry.list('PreToolUse').length, 0);
    });

    it('returns false for non-existent hook', () => {
      assert.equal(registry.unregister('PreToolUse', 'nope'), false);
    });

    it('returns false for invalid event', () => {
      assert.equal(registry.unregister('FakeEvent', 'nope'), false);
    });
  });

  describe('runPreToolUse()', () => {
    it('allows when all hooks allow', () => {
      registry.register('PreToolUse', { name: 'a', fn: () => ({ allow: true }) });
      registry.register('PreToolUse', { name: 'b', fn: () => ({ allow: true }) });

      const result = registry.runPreToolUse({ tool: 'read_file', params: {} });
      assert.equal(result.allow, true);
      assert.equal(result.decisions.length, 2);
    });

    it('blocks when any hook blocks', () => {
      registry.register('PreToolUse', { name: 'allow', fn: () => ({ allow: true }) });
      registry.register('PreToolUse', { name: 'block', fn: () => ({ allow: false, reason: 'dangerous' }) });

      const result = registry.runPreToolUse({ tool: 'run_shell', params: {} });
      assert.equal(result.allow, false);
      assert.ok(result.decisions.find(d => d.name === 'block' && !d.allow));
    });

    it('runs hooks in priority order', () => {
      const order = [];
      registry.register('PreToolUse', { name: 'second', priority: 20, fn: () => { order.push('second'); return { allow: true }; } });
      registry.register('PreToolUse', { name: 'first', priority: 10, fn: () => { order.push('first'); return { allow: true }; } });

      registry.runPreToolUse({ tool: 'test', params: {} });
      assert.deepEqual(order, ['first', 'second']);
    });

    it('returns empty decisions when no hooks registered', () => {
      const result = registry.runPreToolUse({ tool: 'test', params: {} });
      assert.equal(result.allow, true);
      assert.equal(result.decisions.length, 0);
    });
  });

  describe('runPostToolUse()', () => {
    it('passes output through when no transformation', () => {
      registry.register('PostToolUse', {
        name: 'observer',
        fn: () => ({ transformed: false }),
      });

      const result = registry.runPostToolUse({ tool: 'read_file', params: {}, output: 'original' });
      assert.equal(result.output, 'original');
      assert.equal(result.transformations[0].transformed, false);
    });

    it('transforms output when handler provides new output', () => {
      registry.register('PostToolUse', {
        name: 'sanitizer',
        fn: (ctx) => ({ output: ctx.output.toUpperCase(), transformed: true }),
      });

      const result = registry.runPostToolUse({ tool: 'read_file', params: {}, output: 'hello' });
      assert.equal(result.output, 'HELLO');
      assert.equal(result.transformations[0].transformed, true);
    });

    it('chains transformations in priority order', () => {
      registry.register('PostToolUse', {
        name: 'first',
        priority: 10,
        fn: (ctx) => ({ output: ctx.output + '-first', transformed: true }),
      });
      registry.register('PostToolUse', {
        name: 'second',
        priority: 20,
        fn: (ctx) => ({ output: ctx.output + '-second', transformed: true }),
      });

      const result = registry.runPostToolUse({ tool: 'test', params: {}, output: 'start' });
      assert.equal(result.output, 'start-first-second');
    });
  });

  describe('runEndOfTurn()', () => {
    it('executes all registered hooks', () => {
      const log = [];
      registry.register('EndOfTurn', { name: 'logger', fn: (ctx) => { log.push(ctx.agentId); } });
      registry.register('EndOfTurn', { name: 'counter', fn: () => { log.push('counted'); } });

      const result = registry.runEndOfTurn({ agentId: 'agent-1', status: 'completed' });
      assert.deepEqual(result.executed, ['logger', 'counter']);
      assert.deepEqual(log, ['agent-1', 'counted']);
    });
  });

  describe('clear()', () => {
    it('clears hooks for a specific event', () => {
      registry.register('PreToolUse', { name: 'a', fn: () => ({}) });
      registry.register('PostToolUse', { name: 'b', fn: () => ({}) });
      registry.clear('PreToolUse');
      assert.equal(registry.list('PreToolUse').length, 0);
      assert.equal(registry.list('PostToolUse').length, 1);
    });

    it('clears all hooks when no event specified', () => {
      registry.register('PreToolUse', { name: 'a', fn: () => ({}) });
      registry.register('PostToolUse', { name: 'b', fn: () => ({}) });
      registry.register('EndOfTurn', { name: 'c', fn: () => ({}) });
      registry.clear();
      for (const ev of HOOK_EVENTS) {
        assert.equal(registry.list(ev).length, 0);
      }
    });
  });
});

describe('nyquistSafetyHook', () => {
  it('allows non-shell tools without inspection', () => {
    const result = nyquistSafetyHook.fn({ tool: 'read_file', params: { path: '/foo' } });
    assert.equal(result.allow, true);
  });

  it('allows safe shell commands', () => {
    const result = nyquistSafetyHook.fn({ tool: 'execute_command', params: { command: 'ls -la' } });
    assert.equal(result.allow, true);
    assert.ok(result.reason.includes('SAFE'));
  });

  it('allows guarded commands with warning', () => {
    const result = nyquistSafetyHook.fn({ tool: 'execute_command', params: { command: 'npm install express' } });
    assert.equal(result.allow, true);
    assert.ok(result.reason.includes('GUARDED'));
  });

  it('blocks dangerous commands', () => {
    const result = nyquistSafetyHook.fn({ tool: 'execute_command', params: { command: 'rm -rf /' } });
    assert.equal(result.allow, false);
    assert.ok(result.reason.includes('BLOCKED'));
  });

  it('allows empty commands', () => {
    const result = nyquistSafetyHook.fn({ tool: 'execute_command', params: {} });
    assert.equal(result.allow, true);
  });
});

describe('createDefaultHooks()', () => {
  it('creates a registry with nyquist safety hook pre-registered', () => {
    const registry = createDefaultHooks();
    const hooks = registry.list('PreToolUse');
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0].name, 'nyquist-safety');
    assert.equal(hooks[0].priority, 0);
  });

  it('blocks dangerous commands through the default registry', () => {
    const registry = createDefaultHooks();
    const result = registry.runPreToolUse({
      tool: 'execute_command',
      params: { command: 'sudo rm -rf /' },
    });
    assert.equal(result.allow, false);
  });
});
