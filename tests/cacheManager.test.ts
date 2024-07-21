import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { Database } from 'bun:sqlite';
import cacheManager from 'cache-manager';
import type { Cache, MultiCache } from 'cache-manager';

import { getRandomPath } from './helpers/index.js';

import sqliteStore from '../index.js';
import bunSqliteStore, { SqliteStore } from '../index.js';

describe('Cache Manager', () => {
  describe('Multi caching', () => {
    let cache: MultiCache;

    beforeEach(async () => {
      cache = cacheManager.multiCaching([
        await cacheManager.caching(sqliteStore, { path: getRandomPath(), ttl: 500 }),
      ]);
    });

    it('should not get value when TTL is negative', async () => {
      const key = 'foo' + Date.now();
      const value = { foo: 1 };

      await cache.set(key, value, -200);
      const response = await cache.get(key);
      expect(response).toBe(undefined);
    });

    it('should read saved value', async () => {
      const key = 'foo' + Date.now();
      const value = { foo: 1 };

      await cache.set(key, value);
      const response = await cache.get(key);
      expect(response).toEqual(value);
    });

    it('should respect default TTL', async () => {
      const key = 'foo' + Date.now();
      const value = { foo: 1 };

      await cache.set(key, value);
      await new Promise(resolve => setTimeout(resolve, 600));

      const response = await cache.get(key);
      expect(response).toEqual(value);
    });

    it('should not error on deleting non-existent key', async () => {
      const key = 'foo' + Date.now();
      await cache.del(key);
    });

    it('should remove existing key with del', async () => {
      const key = 'foo' + Date.now();
      const value = { foo: 1 };

      await cache.set(key, value);
      await cache.del(key);
      const v = await cache.get(key);
      expect(v).toBe(undefined);
    });

    it('should truncate database on reset', async () => {
      const key = 'foo' + Date.now();
      const value = { foo: 1 };

      await cache.set(key, value);
      await cache.reset();
      const v = await cache.get(key);
      expect(v).toBe(undefined);
    });

    it('should fetch array of multiple objects with mget', async () => {
      await cache.set('foo1', 1);
      await cache.set('foo2', 2);
      await cache.set('foo3', 3);
      const rs = await cache.mget('foo1', 'foo2', 'foo3');
      expect(rs).toEqual([1, 2, 3]);
    });

    it('should set multiple values with mset', async () => {
      await cache.mset([
        ['goo1', 1],
        ['goo2', 2],
        ['goo3', 3],
      ]);
      const rs = await cache.mget('goo1', 'goo2', 'goo3');
      expect(rs).toEqual([1, 2, 3]);
    });

    it('should respect TTL in mset', async () => {
      await cache.mset(
        [
          ['too1', 1],
          ['too2', 2],
          ['too3', 3],
        ],
        -1
      );
      const rs = await cache.mget('too1', 'too2', 'too3');
      expect(rs).toEqual([undefined, undefined, undefined]);
    });
  });

  describe('Single Caching', () => {
    let cache: Cache<SqliteStore>;

    beforeEach(async () => {
      cache = await cacheManager.caching(bunSqliteStore, { path: getRandomPath() });
    });

    describe('Initialization', () => {
      it('should open store via options', async () => {
        const cache = await cacheManager.caching(bunSqliteStore, {
          path: '/tmp/cache.db',
        });
        expect(cache).toBeDefined();
      });

      it('should use default options', async () => {
        const cache = await cacheManager.caching(bunSqliteStore);
        expect(cache).toBeDefined();
      });
    });

    describe('Caching Operations', () => {
      it('should not get value when TTL is negative', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value, -200);
        const response = await cache.get(key);
        expect(response).toBe(undefined);
      });

      it('should read saved value', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        const response = await cache.get(key);
        expect(response).toEqual(value);
      });

      it('should not error on deleting non-existent key', async () => {
        const key = 'foo' + Date.now();
        await cache.del(key);
      });

      it('should remove existing key with del', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        await cache.del(key);
        const v = await cache.get(key);
        expect(v).toBe(undefined);
      });

      it('should truncate database on reset', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        await cache.reset();
        const v = await cache.get(key);
        expect(v).toBe(undefined);
      });

      it('should return TTL of key', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        const v = await cache.store.ttl(key);
        expect(v).toBeGreaterThan(0);
      });

      it('should return negative TTL for non-existent keys', async () => {
        const key = 'foo' + Date.now();
        const v = await cache.store.ttl(key);
        expect(v).toBeLessThan(0);
      });

      it('should handle various TTL combinations in set', async () => {
        const key1 = 'foo' + Date.now();
        const value1 = { foo: 1 };

        await cache.set(key1, value1, -1);
        expect(await cache.get(key1)).toBe(undefined);

        const key2 = 'bar' + Date.now();
        const value2 = { bar: 2 };

        await cache.set(key2, value2, 0);
        expect(await cache.get(key2)).toBe(undefined);

        const key3 = 'baz' + Date.now();
        const value3 = { baz: 3 };

        await cache.set(key3, value3, 2);
        expect(await cache.get(key3)).toEqual(value3);

        await new Promise(resolve => setTimeout(resolve, 2100));
        expect(await cache.get(key3)).toBe(undefined);
      });

      it('should fetch array of multiple objects with mget', async () => {
        await cache.set('foo1', 1);
        await cache.set('foo2', 2);
        await cache.set('foo3', 3);
        const rs = await cache.store.mget('foo1', 'foo2', 'foo3');
        expect(rs).toEqual([1, 2, 3]);
      });

      it('should set multiple values with mset', async () => {
        await cache.store.mset([
          ['goo1', 1],
          ['goo2', 2],
          ['goo3', 3],
        ]);
        const rs = await cache.store.mget('goo1', 'goo2', 'goo3');
        expect(rs).toEqual([1, 2, 3]);
      });

      it('should respect TTL in mset', async () => {
        await cache.store.mset(
          [
            ['too1', 1],
            ['too2', 2],
            ['too3', 3],
          ],
          -1
        );
        const rs = await cache.store.mget('too1', 'too2', 'too3');
        expect(rs).toEqual([undefined, undefined, undefined]);
      });
    });

    describe('Sqlite Error Handling', () => {
      let allSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(async () => {
        cache = await cacheManager.caching(bunSqliteStore, { path: getRandomPath() });
      });

      beforeEach(() => {
        allSpy = vi.spyOn(Database.prototype, 'all');
        allSpy.mockClear();
      });

      afterEach(() => {
        allSpy.mockRestore();
      });

      it('should handle get errors from sqlite', async () => {
        allSpy.mockImplementation(() => Promise.reject(new Error('Fake error')));
        try {
          await cache.get('foo');
        } catch (e: any) {
          expect(e.message).toBe('Fake error');
        }
      });

      it('should handle ttl errors from sqlite', async () => {
        allSpy.mockImplementation(() => Promise.reject(new Error('Fake error')));
        try {
          await cache.store.ttl('foo');
        } catch (e: any) {
          expect(e.message).toBe('Fake error');
        }
      });

      it('should return undefined for junk stored values', async () => {
        const ts = Date.now();
        allSpy.mockImplementation(() =>
          Promise.resolve([
            { key: 'foo', val: '~junk~', created_at: ts, expire_at: ts + 36000 },
          ])
        );
        expect(await cache.get('foo')).toBe(undefined);

        allSpy.mockClear();
        allSpy.mockImplementation(() =>
          Promise.resolve([
            { key: 'foo', val: undefined, created_at: ts, expire_at: ts + 36000 },
          ])
        );
        expect(await cache.get('foo')).toBe(undefined);
      });
    });
  });
});
