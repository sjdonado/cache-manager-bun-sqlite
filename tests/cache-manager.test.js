import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import cacheManager from 'cache-manager';

import sqliteStore from '../index.js';

describe('cacheManager open callback', () => {
    it('should be able to open via options', done => {
        cacheManager.caching({
            store: sqliteStore,
            name: 'fool',
            path: '/tmp/cache.db',
            options: {
                onReady: done,
            },
        });
    });

    it('should be able to use default options', done => {
        cacheManager.caching({
            store: sqliteStore,
            options: {
                onReady: done,
            },
        });
    });
});

describe('cacheManager promised', () => {
    const cache = cacheManager.caching({
        store: sqliteStore,
        path: '/tmp/test1.db',
    });

    it('set should serialized bad object to undefined', async () => {
        await cache.set('foo-bad', function() { });
        expect(await cache.get('foo-bad')).toBe(undefined);
    });

    it('get value when TTL within range from set', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu, { ttl: -200 });
        const val = await cache.get(key);
        expect(val).toBe(undefined);
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
        expect(v).toBe(undefined);
    });

    it('truncates database on reset', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu);
        await cache.reset();
        const v = await cache.get(key);
        expect(v).toBe(undefined);
    });

    it('returns ttl of key', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu);
        const v = await cache.ttl(key);
        expect(v).toBeGreaterThan(0);
    });

    it('returns ttl a negative value for non-existent keys', async () => {
        const key = 'foo' + new Date().getTime();
        const v = await cache.ttl(key);
        expect(v).toBeLessThan(0);
    });

    it('works with various combinations of passing ttl to set', async () => {
        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu, -1);
        expect(await cache.get(key)).toBe(undefined);

        await cache.set(key, valu, { ttl: -1 });
        expect(await cache.get(key)).toBe(undefined);
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
        expect(rs).toEqual([undefined, undefined, undefined]);
    });
});

describe('Sqlite failures', () => {
    const cache = cacheManager.caching({
        store: sqliteStore,
    });

    let allSpy;

    beforeEach(() => {
        allSpy = vi.spyOn(Database.prototype, 'all');
        allSpy.mockClear();
    });

    afterEach(() => {
        allSpy.mockRestore();
    });

    it('should fail get if sqlite errors out', async () => {
        allSpy.mockImplementation(() => Promise.reject(new Error('Fake error')));
        try {
            await cache.get('foo');
        } catch (e) {
            expect(e.message).toBe('Fake error');
        }
    });

    it('should fail ttl if sqlite errors out', async () => {
        allSpy.mockImplementation(() => Promise.reject(new Error('Fake error')));
        try {
            await cache.ttl('foo');
        } catch (e) {
            expect(e.message).toBe('Fake error');
        }
    });

    it('should return undefined value if stored value is junk', async () => {
        const ts = new Date().getTime();
        allSpy.mockImplementation(() =>
            Promise.resolve([
                { key: 'foo', val: '~junk~', created_at: ts, expire_at: ts + 36000 },
            ])
        );
        expect(await cache.get('foo')).toBe(undefined);

        allSpy.mockClear();
        allSpy.mockImplementation(() =>
            Promise.resolve([
                { key: 'foo', val: 'undefined', created_at: ts, expire_at: ts + 36000 },
            ])
        );
        expect(await cache.get('foo')).toBe(undefined);
    });
});

describe('sqliteStore construction', () => {
    it('should apply default ttl of store when not passed in set', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: {
                ttl: -1,
            },
        });

        const key = 'foo' + new Date().getTime();
        const valu = { foo: 1 };

        await cache.set(key, valu);
        expect(await cache.get(key)).toBe(undefined);
    });
});

describe('cacheManager callback', () => {
    const cache = cacheManager.caching({
        store: sqliteStore,
    });

    it('get should return undefined when value does not exist', done => {
        cache.get('!!!' + Math.random(), (err, res) => {
            expect(res).toBe(undefined);
            done(err);
        });
    });

    it('set should serialize objects', done => {
        cache.set('foo', { foo: 1 }, err => {
            done(err);
        });
    });

    it('mset sets multiple values in single call', done => {
        cache.mset('goo1', 1, 'goo2', 2, 'goo3', 3, err => {
            done(err);
        });
    });

    it('mset sets multiple values with TTL', done => {
        cache.mset('goo1', 1, 'goo2', 2, 'goo3', 3, { ttl: 10 }, err => {
            done(err);
        });
    });

    it('mget gets multiple values', done => {
        cache.mset('goo1', 1, 'goo2', 2, 'goo3', 3, { ttl: 10 }, err => {
            if (err) {
                return done(err);
            }

            cache.mget('goo1', 'goo2', 'goo3', (err, res) => {
                expect(res).toEqual([1, 2, 3]);
                done(err);
            });
        });
    });
});
