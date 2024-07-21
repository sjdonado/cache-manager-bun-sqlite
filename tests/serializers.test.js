import { describe, it, expect } from 'bun:test';
import cacheManager from 'cache-manager';

import sqliteStore from '../index.js';

describe('cacheManager serializers', () => {
    it('supports CBOR', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: { serializer: 'cbor' },
        });

        await cache.set('foo', { foo: 'bar', arr: [1, true, null] });
        expect(await cache.get('foo')).toEqual({ foo: 'bar', arr: [1, true, null] });
    });

    it('supports JSON', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: { serializer: 'json' },
        });

        await cache.set('foo', { foo: 'bar', arr: [1, true, null] });
        expect(await cache.get('foo')).toEqual({ foo: 'bar', arr: [1, true, null] });
    });
});

describe('cacheManager custom serializers', () => {
    it('Bad serializer does not save', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: {
                serializer: {
                    serialize: () => {
                        throw new Error('Fake error');
                    },
                    deserialize: () => {
                        throw new Error('Fake error');
                    },
                },
            },
        });

        await cache.set('foo', { foo: 'bar', arr: [1, true, null] });
        expect(await cache.get('foo')).toBe(null);
    });

    it('bad deserializer returns null', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: {
                serializer: {
                    serialize: p => JSON.stringify(p),
                    deserialize: () => {
                        throw new Error('Fake error');
                    },
                },
            },
        });

        await cache.set('foo', { foo: 'bar', arr: [1, true, null] });
        expect(await cache.get('foo')).toBe(null);
    });
});
