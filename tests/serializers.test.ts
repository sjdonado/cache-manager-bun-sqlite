import { describe, it, expect } from 'bun:test';
import cacheManager from 'cache-manager';

import sqliteStore from '../index.js';

describe('Serializers', () => {
  it('supports msgpackr', async () => {
    const cache = await cacheManager.caching(sqliteStore, {
      serializer: 'msgpackr',
    });

    const value = {
      foo: 'bar',
      arr: [1, true, null],
      id: '2KvHC9z14GSl4YpkNMX384',
      description: 'Test · Unicode · Description',
      hash: 'https://hash/ab67616d0000b2734f0fd9dad63977146e685700',
      link: 'https://a.test.com/path/df989a31c8233f46b6a997c59025f9c8021784aa',
    };

    await cache.set('foo', value);

    expect(await cache.get('foo')).toEqual(value);
  });

  it('supports cbor', async () => {
    const cache = await cacheManager.caching(sqliteStore, {
      serializer: 'cbor',
    });

    const value = {
      foo: 'bar',
      arr: [1, true, null],
      id: '2KvHC9z14GSl4YpkNMX384',
    };

    await cache.set('foo', value);

    expect(await cache.get('foo')).toEqual(value);
  });

  it('supports JSON', async () => {
    const cache = await cacheManager.caching(sqliteStore, {
      serializer: 'json',
    });

    const value = {
      foo: 'bar',
      arr: [1, true, null],
      id: '2KvHC9z14GSl4YpkNMX384',
      description: 'Test · Unicode · Description',
      hash: 'https://hash/ab67616d0000b2734f0fd9dad63977146e685700',
      link: 'https://a.test.com/path/df989a31c8233f46b6a997c59025f9c8021784aa',
    };

    await cache.set('foo', value);

    expect(await cache.get('foo')).toEqual(value);
  });

  it('should throw NoCacheableError when setting a bad object', async () => {
    const cache = await cacheManager.caching(sqliteStore);

    await expect(cache.set('foo-bad', function() { })).rejects.toThrow(
      '"function() {\n    }" is not a cacheable value'
    );
  });
});
