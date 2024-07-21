import { describe, it, expect } from 'bun:test';
import cacheManager from 'cache-manager';

import sqliteStore from '../index.js';

describe('cacheManager promised', () => {
    const cache = cacheManager.multiCaching([
        cacheManager.caching({
            store: sqliteStore,
            path: '/tmp/test1.db',
        }),
    ]);

    it('set should serialized bad object to null', async () => {
        await cache.set('foo-bad', function() { });
        expect(await cache.get('foo-bad')).toBe(null);
    });

    it('get value when TTL within range from set', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu, { ttl: -200 });
        const val = await cache.get(key);
        expect(val).toBe(null);
    });

    it('should read saved value', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu);
        const val = await cache.get(key);
        expect(val).toEqual(valu);
    });

    it('does not error on del non-existent key', async () => {
        const key = 'foo' + new Date().getTime();

        await cache.del(key);
        // No assertion needed, just ensure it does not throw
    });

    it('removes existing key with del', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu);
        await cache.del(key);
        const v = await cache.get(key);
        expect(v).toBe(null);
    });

    it('truncates database on reset', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu);
        await cache.reset();
        const v = await cache.get(key);
        expect(v).toBe(null);
    });

    it('mget fetches array of multiple objects', async () => {
        await cache.set('foo1', 1);
        await cache.set('foo2', 2);
        await cache.set('foo3', 3);
        const rs = await cache.mget('foo1', 'foo2', 'foo3');
        expect(rs).toEqual([1, 2, 3]);
    });

    it('mget can handle options', async () => {
        const rs = await cache.mget('foo1', 'foo2', 'foo3', {});
        expect(rs).toEqual([1, 2, 3]);
    });

    it('mset sets multiple values in single call', async () => {
        await cache.mset([
            ['goo1', 1],
            ['goo2', 2],
            ['goo3', 3],
        ]);
        const rs = await cache.mget('goo1', 'goo2', 'goo3');
        expect(rs).toEqual([1, 2, 3]);
    });

    it('mset respects ttl if passed', async () => {
        await cache.mset(
            [
                ['too1', 1],
                ['too2', 2],
                ['too3', 3],
            ],
            { ttl: -1 }
        );
        const rs = await cache.mget('too1', 'too2', 'too3');
        expect(rs).toEqual([null, null, null]);
    });
});
