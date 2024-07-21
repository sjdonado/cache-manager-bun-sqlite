import { Database } from 'bun:sqlite';
import util from 'util';
import { decode, encode } from 'cbor-x';

const configurePragmas = `
PRAGMA main.synchronous = NORMAL;
PRAGMA main.journal_mode = WAL2;
PRAGMA main.auto_vacuum = INCREMENTAL;
`;

const createTableStm = `
CREATE TABLE IF NOT EXISTS %s (
    key TEXT PRIMARY KEY, 
    val BLOB, 
    created_at INTEGER, 
    expire_at INTEGER
);
CREATE INDEX IF NOT EXISTS index_expire_%s ON %s(expire_at);
`;

const serializers = {
  json: {
    serialize: o => JSON.stringify(o),
    deserialize: p => JSON.parse(p),
  },
  cbor: {
    serialize: o => encode(o),
    deserialize: p => decode(p),
  },
};

class SqliteCacheStore {
  constructor({ name, path, serializer, ttl, onOpen, onReady }) {
    this.name = name || 'cache';
    this.path = path || ':memory:';
    this.default_ttl = ttl || 24 * 60 * 60; // Default TTL in seconds
    this.serializer = serializers[serializer || 'cbor'];

    this.db = new Database(this.path);

    try {
      this.db.exec(configurePragmas);
      const stmt = util.format(createTableStm, this.name, this.name, this.name);
      this.db.exec(stmt);

      onReady?.();
      onOpen?.();
    } catch (err) {
      onOpen?.(err);
    }

    // Schedule periodic purge of expired entries
    setInterval(
      () => {
        this.purgeExpired();
      },
      60 * 60 * 1000 // Every hour
    );
  }

  get(key, options) {
    const ts = new Date().getTime();
    const rows = this._fetchAll([key]);
    if (rows.length > 0 && rows[0].expire_at > ts) {
      return this._deserialize(rows[0].val);
    }
    return null;
  }

  set(key, value, options = {}) {
    const ttl = (options.ttl || this.default_ttl) * 1000;
    const ts = new Date().getTime();
    const expire = ts + ttl;
    const val = this._serialize(value);
    const stmt = `INSERT OR REPLACE INTO ${this.name}(key, val, created_at, expire_at) VALUES (?, ?, ?, ?)`;
    this.db.run(stmt, key, val, ts, expire);
  }

  del(key) {
    const stmt = `DELETE FROM ${this.name} WHERE key = ?`;
    this.db.run(stmt, key);
  }

  reset() {
    const stmt = `DELETE FROM ${this.name}`;
    this.db.run(stmt);
  }

  keys() {
    const stmt = `SELECT key FROM ${this.name}`;
    const rows = this.db.all(stmt);
    return rows.map(row => row.key);
  }

  mset(pairs, options = {}) {
    const ttl = (options.ttl || this.default_ttl) * 1000;
    const ts = new Date().getTime();
    const expire = ts + ttl;
    const bindings = pairs.flatMap(([key, value]) => [
      key,
      this._serialize(value),
      ts,
      expire,
    ]);
    const placeholders = pairs.map(() => '(?, ?, ?, ?)').join(', ');
    const stmt = `INSERT OR REPLACE INTO ${this.name}(key, val, created_at, expire_at) VALUES ${placeholders}`;
    this.db.run(stmt, ...bindings);
  }

  mget(...keys) {
    const ts = new Date().getTime();
    const rows = this._fetchAll(keys);
    return rows.map(row => (row.expire_at > ts ? this._deserialize(row.val) : null));
  }

  mdel(...keys) {
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = `DELETE FROM ${this.name} WHERE key IN (${placeholders})`;
    this.db.run(stmt, ...keys);
  }

  _fetchAll(keys) {
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = `SELECT * FROM ${this.name} WHERE key IN (${placeholders})`;
    return this.db.all(stmt, ...keys);
  }

  purgeExpired() {
    const stmt = `DELETE FROM ${this.name} WHERE expire_at < ?`;
    this.db.run(stmt, new Date().getTime());
  }

  _serialize(obj) {
    try {
      return this.serializer.serialize(obj);
    } catch (e) {
      return undefined;
    }
  }

  _deserialize(payload) {
    try {
      return this.serializer.deserialize(payload);
    } catch (e) {
      return undefined;
    }
  }
}

export default {
  create: config => new SqliteCacheStore(config),
};
