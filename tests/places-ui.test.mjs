import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Exercise the actual browser flow, including the polling loop. Backend tests
// alone do not catch losing a job ID between successive status responses.
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('async function searchPlaces() {'), app.indexOf('\nfunction navigate('));

async function runSearch(replies) {
  const state = {};
  const calls = [];
  const notices = [];
  const inputs = { 'prospect-segment': 'Mercado', 'prospect-city': 'Camboriú', 'prospect-state': 'SC' };
  const search = runInNewContext(`${source}\nsearchPlaces`, {
    state, window: { verdiAuth: { session: { access_token: 'test-token' } } },
    document: { getElementById: id => ({ value: inputs[id] || '' }) },
    render: () => {}, toast: message => notices.push(message),
    URLSearchParams, AbortSignal, setTimeout: resolve => resolve(),
    fetch: async (url, options) => {
      calls.push({ url, method: options.method || 'GET' });
      const reply = replies.shift();
      assert.ok(reply, 'Unexpected extra request');
      if (reply instanceof Error) throw reply;
      return reply;
    },
  });
  await search();
  return { state, calls, notices };
}

const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status });

test('browser retains the original job across progress, timeouts and HTTP 504', async () => {
  const timeout = new Error('The operation was aborted due to timeout');
  timeout.name = 'TimeoutError';
  const { state, calls } = await runSearch([
    json({ status: 'processing', jobId: 'remote-123' }, 202),
    json({ status: 'processing' }),
    timeout,
    new Response('<h1>Gateway Timeout</h1>', { status: 504 }),
    json({ status: 'processing' }),
    json({ status: 'completed', provider: 'google-maps-scraper', results: [{ name: 'Mercado Central' }] }),
  ]);
  assert.equal(calls.length, 6);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  for (const call of calls.slice(1)) assert.match(call.url, /^\/api\/places-search\/remote-123\?/);
  assert.equal(state.prospectResults[0].name, 'Mercado Central');
  assert.equal(state.prospectLoading, false);
});

test('browser stops on expired authentication instead of retrying indefinitely', async () => {
  const { state, calls } = await runSearch([
    json({ status: 'processing', jobId: 'remote-123' }, 202),
    json({ error: 'Entre no sistema para ver os resultados.' }, 401),
  ]);
  assert.equal(calls.length, 2);
  assert.equal(state.prospectMessage, 'Entre no sistema para ver os resultados.');
  assert.equal(state.prospectLoading, false);
});
