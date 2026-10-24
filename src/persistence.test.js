import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore, readStore, STORAGE_KEY, writeStore } from './persistence.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
  };
}

test('starts with an empty workspace when no saved data exists', () => {
  assert.deepEqual(readStore(memoryStorage()).data, emptyStore());
});

test('round trips projects and sessions through local storage', () => {
  const storage = memoryStorage();
  const data = { projects: [{ id: 'one', steps: [] }], sessions: { one: { completed: true } } };
  assert.equal(writeStore(data, storage), true);
  assert.deepEqual(readStore(storage).data, data);
  assert.equal(STORAGE_KEY, 'skillmirror.prototype.v1');
});

test('recovers from invalid JSON and invalid project records', () => {
  assert.equal(readStore(memoryStorage('{broken')).recovered, true);
  assert.equal(readStore(memoryStorage('{"projects":false}')).recovered, true);
  assert.deepEqual(readStore(memoryStorage('{"projects":[null,{"id":"ok","steps":[]}]}')).data.projects, [
    { id: 'ok', steps: [] },
  ]);
});

test('reports a storage write failure without throwing', () => {
  const storage = { setItem: () => { throw new Error('quota'); } };
  assert.equal(writeStore(emptyStore(), storage), false);
});

test('recovers when browser storage access itself is denied', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('storage access denied'); },
  });

  try {
    assert.deepEqual(readStore().data, emptyStore());
    assert.equal(writeStore(emptyStore()), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});