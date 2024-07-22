import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'bun:test';
import { Database } from 'bun:sqlite';
import cacheManager from 'cache-manager';
import type { Cache } from 'cache-manager';

import { getRandomPath } from './helpers/index.js';

import bunSqliteStore, { NoCacheableError, SqliteStore } from '../index.js';

describe('Cache Manager', () => {
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
    let cache: Cache<SqliteStore>;

    beforeEach(async () => {
      cache = await cacheManager.caching(bunSqliteStore, { path: getRandomPath() });
    });

    describe('set', () => {
      it('should set a value', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 3 };

        await cache.set(key, value);
        expect(await cache.get(key)).toEqual(value);
      });

      it('should set a value with TTL', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 3 };

        await cache.set(key, value, 1);
        expect(await cache.get(key)).toEqual(value);

        await new Promise(resolve => setTimeout(resolve, 1100));
        expect(await cache.get(key)).toBe(undefined);
      });

      it('should set an already expired value - zero', async () => {
        const key = 'bar' + Date.now();
        const value = { bar: 2 };

        await cache.set(key, value, 0);
        expect(await cache.get(key)).toBe(undefined);
      });

      it('should set a value and get it after expired', async () => {
        const key = 'baz' + Date.now();
        const value = { baz: 3 };

        await cache.set(key, value, 1);
        expect(await cache.get(key)).toEqual(value);

        await new Promise(resolve => setTimeout(resolve, 1100));
        expect(await cache.get(key)).toBe(undefined);
      });

      it('should not set value if negative', async () => {
        const key = 'test' + Date.now();
        const value = { test: 2 };

        await cache.set(key, value, -100);
        expect(await cache.get(key)).toBe(undefined);
      });
    });

    describe('get', () => {
      it('should read saved value', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        const response = await cache.get(key);
        expect(response).toEqual(value);
      });

      it('should not get value when TTL is negative', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value, -200);
        const response = await cache.get(key);
        expect(response).toBe(undefined);
      });
    });

    describe('del', () => {
      it('should remove existing key', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        await cache.del(key);
        const v = await cache.get(key);
        expect(v).toBe(undefined);
      });

      it('should not error on deleting non-existent key', async () => {
        const key = 'foo' + Date.now();
        await cache.del(key);
      });
    });

    describe('mset', () => {
      it('should set multiple values', async () => {
        await cache.store.mset([
          ['goo1', 1],
          ['goo2', 2],
          ['goo3', 3],
        ]);
        const rs = await cache.store.mget('goo1', 'goo2', 'goo3');
        expect(rs).toEqual([1, 2, 3]);
      });

      it('should set multiple values with TTL', async () => {
        await cache.store.mset(
          [
            ['goo4', 4],
            ['goo5', 5],
            ['goo6', 6],
          ],
          1
        );
        const rs = await cache.store.mget('goo4', 'goo5', 'goo6');
        expect(rs).toEqual([4, 5, 6]);

        await new Promise(resolve => setTimeout(resolve, 1100));
        const rsExpired = await cache.store.mget('goo4', 'goo5', 'goo6');
        expect(rsExpired).toEqual([undefined, undefined, undefined]);
      });

      it('should not set multiple values if TTL is negative', async () => {
        await cache.store.mset(
          [
            ['goo7', 7],
            ['goo8', 8],
            ['goo9', 9],
          ],
          -1
        );

        const rs = await cache.store.mget('goo7', 'goo8', 'goo9');
        expect(rs).toEqual([undefined, undefined, undefined]);
      });
    });

    describe('mget', () => {
      it('should fetch array of multiple objects', async () => {
        await cache.set('foo1', 1);
        await cache.set('foo2', 2);
        await cache.set('foo3', 3);
        const rs = await cache.store.mget('foo1', 'foo2', 'foo3');
        expect(rs).toEqual([1, 2, 3]);
      });

      it('should return undefined for non-existent keys', async () => {
        const rs = await cache.store.mget('foo4', 'foo5', 'foo6');
        expect(rs).toEqual([undefined, undefined, undefined]);
      });
    });

    describe('mdel', () => {
      it('should remove multiple keys', async () => {
        await cache.store.mset([
          ['goo10', 10],
          ['goo11', 11],
          ['goo12', 12],
        ]);
        await cache.store.mdel('goo10', 'goo11', 'goo12');
        const rs = await cache.store.mget('goo10', 'goo11', 'goo12');
        expect(rs).toEqual([undefined, undefined, undefined]);
      });

      it('should not error on deleting non-existent keys', async () => {
        await cache.store.mdel('goo13', 'goo14', 'goo15');
      });
    });

    describe('keys', () => {
      it('should return all keys', async () => {
        await cache.store.mset([
          ['goo16', 16],
          ['goo17', 17],
          ['goo18', 18],
        ]);
        const keys = await cache.store.keys();
        expect(keys).toEqual(expect.arrayContaining(['goo16', 'goo17', 'goo18']));
      });

      it('should return an empty array if no keys exist', async () => {
        await cache.store.reset();
        const keys = await cache.store.keys();
        expect(keys).toEqual([]);
      });
    });

    describe('reset', () => {
      it('should truncate database on reset', async () => {
        const key = 'foo' + Date.now();
        const value = { foo: 1 };

        await cache.set(key, value);
        await cache.reset();
        const v = await cache.get(key);
        expect(v).toBe(undefined);
      });
    });

    describe('ttl', () => {
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
    });

    describe('purgeExpired', () => {
      it('should purge expired keys', async () => {
        const key1 = 'exp1' + Date.now();
        const value1 = { foo: 1 };
        const key2 = 'exp2' + Date.now();
        const value2 = { foo: 2 };

        await cache.set(key1, value1, 1);
        await cache.set(key2, value2, 1);

        await new Promise(resolve => setTimeout(resolve, 1100));

        // Manually trigger purgeExpired
        await cache.store.get(key1);
        await cache.store.get(key2);

        const keys = await cache.store.keys();
        expect(keys).toEqual([]);
      });
    });
  });

  describe('isCacheable', () => {
    let cache: Cache<SqliteStore>;

    beforeAll(async () => {
      cache = await cacheManager.caching(bunSqliteStore, { path: getRandomPath() });
    });

    it('should not cache undefined', async () => {
      const key = 'undefined' + Date.now();

      await expect(cache.set(key, undefined)).rejects.toThrow(NoCacheableError);
    });

    it('should not cache null', async () => {
      const key = 'null' + Date.now();

      await expect(cache.set(key, null)).rejects.toThrow(NoCacheableError);
    });

    it('should not cache functions', async () => {
      const key = 'function' + Date.now();
      const value = () => { };

      await expect(cache.set(key, value)).rejects.toThrow(NoCacheableError);
    });

    it('should cache only strings with custom isCacheable function', async () => {
      const customCache = await cacheManager.caching(bunSqliteStore, {
        path: getRandomPath(),
        isCacheable: value => typeof value === 'string',
      });

      const keyString = 'string' + Date.now();
      const valueString = 'this is a string';
      await customCache.set(keyString, valueString);
      expect(await customCache.get(keyString)).toEqual(valueString);

      const keyNumber = 'number' + Date.now();
      const valueNumber = 42;
      await expect(customCache.set(keyNumber, valueNumber)).rejects.toThrow(
        NoCacheableError
      );
    });

    it('should call isCacheable from the store', async () => {
      const value = () => { };
      expect(cache.store.isCacheable(value)).toEqual(false);
    });
  });

  describe('Sqlite Error Handling', () => {
    let cache: Cache<SqliteStore>;
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
