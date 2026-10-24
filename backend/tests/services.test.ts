import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.js';
import { summarizeAttempts } from '../src/routes/learning.routes.js';
import { SampleStepGenerator } from '../src/services/demoGenerator.js';
import { assertStepIdSet } from '../src/services/access.js';
import { LocalMediaStorage } from '../src/storage/localMediaStorage.js';

describe('sample generation', () => {
  it('returns a labelled, unapproved sample draft only for the example task', async () => {
    const result = await new SampleStepGenerator().generate({ title: 'Make a paper bridge', description: 'Fold a sheet.', mode: 'demo' });
    expect(result.provenance).toBe('demo-template');
    expect(result.simulated).toBe(true);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('does not pretend to generate arbitrary tasks or analyze media', async () => {
    await expect(new SampleStepGenerator().generate({ title: 'Electrical wiring', description: 'Connect wires', mode: 'demo' }))
      .rejects.toMatchObject({ code: 'DEMO_TEMPLATE_UNAVAILABLE', status: 422 });
  });
});

describe('step order and report logic', () => {
  it('requires every existing step exactly once during reorder', () => {
    expect(() => assertStepIdSet(['b', 'a'], ['a', 'b'])).not.toThrow();
    expect(() => assertStepIdSet(['a', 'a'], ['a', 'b'])).toThrow(HttpError);
    expect(() => assertStepIdSet(['a'], ['a', 'b'])).toThrow(HttpError);
    expect(() => assertStepIdSet(['a', 'c'], ['a', 'b'])).toThrow(HttpError);
  });

  it('derives completion only from latest human-reviewed passes', () => {
    const summary = summarizeAttempts([
      { id: 'a', title: 'First', position: 0, attempts: [
        { id: 'old', attemptNumber: 1, verificationStatus: 'NEEDS_IMPROVEMENT', feedback: 'Try again', submittedAt: new Date(), simulated: false },
        { id: 'new', attemptNumber: 2, verificationStatus: 'PASSED', feedback: 'Reviewed', submittedAt: new Date(), simulated: false },
      ] },
      { id: 'b', title: 'Second', position: 1, attempts: [] },
    ]);
    expect(summary).toMatchObject({ totalSteps: 2, attemptedSteps: 1, passedSteps: 1, completionPercentage: 50 });
    expect(summary.recommendations).toEqual(['Start with “Second”.']);
  });
});

describe('local media storage', () => {
  it('creates server-generated MIME-based keys and rejects path traversal', () => {
    const storage = new LocalMediaStorage('./backend/storage-test');
    const key = storage.createKey('image/png');
    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/i);
    expect(() => storage.resolveKey('../../package.json')).toThrow(HttpError);
    expect(() => storage.createKey('application/javascript')).toThrow(HttpError);
  });
});