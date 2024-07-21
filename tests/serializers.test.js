import { describe, it, expect } from 'bun:test';
import cacheManager from 'cache-manager';

import sqliteStore from '../index.js';

describe('cacheManager serializers', () => {
  it('supports CBOR', async () => {
    const cache = await cacheManager.caching(sqliteStore, {
      serializer: 'cbor',
    });

    await cache.set('foo', { foo: 'bar', arr: [1, true, null] });
    expect(await cache.get('foo')).toEqual({ foo: 'bar', arr: [1, true, null] });
  });

  it('supports JSON', async () => {
    const cache = await cacheManager.caching(sqliteStore, {
      serializer: 'json',
    });

    await cache.set('foo', { foo: 'bar', arr: [1, true, null] });
    expect(await cache.get('foo')).toEqual({ foo: 'bar', arr: [1, true, null] });
  });
});
