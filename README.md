# Bun SQLite Store for [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager)

- Runs on top of [bun-sqlite](https://bun.sh/docs/api/sqlite)
- Optimized `mset`/`mget` support
- Supports CBOR for efficient and fast storage (selectable between `json` or `cbor`, default: `cbor`)

## Installation

```
bun add cache-manager-bun-sqlite3
```

## Usage

### Single store

```ts
import cacheManager from 'cache-manager';
import bunSqliteStore from 'cache-manager-bun-sqlite3';

// SQLite :memory: cache store
cache = await cacheManager.caching(bunSqliteStore, {
  serializer: 'json', // default is 'cbor'
  ttl: 20, // TTL in seconds
});

// On-disk cache on employees table
const cache = await cacheManager.caching(bunSqliteStore, {
  name: 'employees',
  path: '/tmp/cache.db',
});

// TTL in seconds
await cache.set('foo', { test: 'bar' }, 600);
const value = await cache.get('foo');

// TTL in seconds
await cache.set('foo', { test: 'bar' }, 600);
const value = await cache.get('foo');
```

### Multi-store example:

```ts
import cacheManager from 'cache-manager';
import bunSqliteStore from 'cache-manager-bun-sqlite3';
import redisStore from 'cache-manager-ioredis';

const redisCache = await cacheManager.caching({ store: redisStore, db: 0, ttl: 600 });
const sqliteCache = await cacheManager.caching({
  store: sqliteStore,
  path: '/tmp/cache.db',
  name: 'users',
  ttl: 600,
});

const multiCache = cacheManager.multiCaching([sqliteCache, redisCache]);

// Basic get/set
await multiCache.set('foo2', 'bar2', customTTL);
const v = await multiCache.get('foo2');

// Wrap call example
const userId = 'user-1';

// Optionally pass ttl
await multiCache.wrap(userId, customTTL, async () => {
  console.log('Calling expensive service');
  await getUserFromExpensiveService(userId);
});

// set and get multiple
await multiCache.mset('foo1', 'bar1', 'foo0', 'bar0'); //Uses default TTL
await multiCache.mset('foo1', 'bar1', 'foo3', 'bar3', customTTL);
await multiCache.mget('foo1', 'foo3');
```

## Fork from

[node-cache-manager-sqlite](https://github.com/maxpert/node-cache-manager-sqlite)
