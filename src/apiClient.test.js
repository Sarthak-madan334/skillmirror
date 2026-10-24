import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, ApiClientError, skillMirrorApi } from './apiClient.js';

test('uses credentialed JSON requests and unwraps successful responses', async () => {
  const originalFetch = globalThis.fetch;
  let options;
  globalThis.fetch = async (_url, requestOptions) => {
    options = requestOptions;
    return new Response(JSON.stringify({ success: true, data: { id: 't1' }, error: null }), { status: 201 });
  };
  try {
    const result = await apiRequest('/trainings', { method: 'POST', body: JSON.stringify({ title: 'Bridge' }) });
    assert.deepEqual(result, { id: 't1' });
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('maps safe API error envelopes to a stable client error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    data: null,
    error: { code: 'VALIDATION_ERROR', message: 'Check the title.', details: [{ path: 'title' }] },
  }), { status: 400 });
  try {
    await assert.rejects(apiRequest('/trainings', { method: 'POST', body: '{}' }), (error) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.deepEqual(error.details, [{ path: 'title' }]);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handles no-content responses and failed network requests', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    assert.equal(await apiRequest('/trainings/t1', { method: 'DELETE' }), null);
    globalThis.fetch = async () => new Response('invalid', { status: 200 });
    await assert.rejects(skillMirrorApi.health(), (error) => error.code === 'INVALID_RESPONSE');
  } finally {
    globalThis.fetch = async () => { throw new Error('offline'); };
    try {
      await assert.rejects(skillMirrorApi.health(), (error) => error.code === 'API_UNAVAILABLE');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test('creates URL-encoded identifiers and multipart uploads without overriding content type', async () => {
  const originalFetch = globalThis.fetch;
  let url = '';
  let options;
  globalThis.fetch = async (requestUrl, requestOptions) => {
    url = requestUrl;
    options = requestOptions;
    return new Response(JSON.stringify({ success: true, data: { id: 'asset-1' }, error: null }), { status: 201 });
  };
  try {
    await skillMirrorApi.getTraining('unsafe/id');
    assert.ok(url.includes('unsafe%2Fid'));
    const file = new Blob(['image'], { type: 'image/png' });
    await skillMirrorApi.uploadEvidence('session-1', 'step-1', file);
    assert.equal(options.body instanceof FormData, true);
    assert.equal(options.headers.has('Content-Type'), false);
    assert.equal(options.body.get('stepId'), 'step-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});