import sqlite3 from 'sqlite3';
import util from 'util';
import { decode, encode } from 'cbor-x';

const ConfigurePragmas = `
PRAGMA main.synchronous = NORMAL;
PRAGMA main.journal_mode = WAL2;
PRAGMA main.auto_vacuum = INCREMENTAL;
`;

const CreateTableStatement = `
CREATE TABLE IF NOT EXISTS %s (
    key TEXT PRIMARY KEY, 
    val BLOB, 
    created_at INTEGER, 
    expire_at INTEGER
);
CREATE INDEX IF NOT EXISTS index_expire_%s ON %s(expire_at);
`;

const DeleteStatement = 'DELETE FROM %s WHERE key IN (%s)';
const TruncateStatement = 'DELETE FROM %s';
const PurgeExpiredStatement = 'DELETE FROM %s WHERE expire_at < $ts';
const UpsertManyStatementPrefix =
  'INSERT OR REPLACE INTO %s(key, val, created_at, expire_at) VALUES ';

function now() {
  return new Date().getTime();
}

function generatePlaceHolders(length) {
  return '(' + '?'.repeat(length).split('').join(', ') + ')';
}

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
  constructor(config) {
    const { name, path, serializer, ttl, flags, onOpen, onReady } = config;
    this.name = name || 'cache';
    this.path = path || ':memory:';
    this.default_ttl = ttl || 24 * 60 * 60; // Default TTL in seconds
    this.serializer = serializers[serializer || 'cbor'];
    const mode = flags || sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE;

    this.db = new sqlite3.Database(this.path, mode, err => {
      if (err) {
        if (onOpen) onOpen(err);
        return;
      }
      this.db.serialize(() => {
        const stmt =
          ConfigurePragmas +
          util.format(CreateTableStatement, this.name, this.name, this.name);
        this.db.exec(stmt, err => {
          if (onReady) onReady(err);
        });
      });
      if (onOpen) onOpen(null);
    });

    // Schedule periodic purge of expired entries
    setInterval(
      () => {
        this.purgeExpired();
      },
      60 * 60 * 1000
    ); // Every hour
  }

  async get(key, options) {
    const ts = now();
    const rows = await this._fetch_all([key]);
    if (rows.length > 0 && rows[0].expire_at > ts) {
      return this._deserialize(rows[0].val);
    }
    return undefined;
  }

  async set(key, value, options) {
    const ttl = (options.ttl || this.default_ttl) * 1000;
    const ts = now();
    const expire = ts + ttl;
    const val = this._serialize(value);
    const stmt = util.format(
      UpsertManyStatementPrefix + generatePlaceHolders(4),
      this.name
    );
    await this._run(stmt, [key, val, ts, expire]);
  }

  async del(key) {
    const stmt = util.format(DeleteStatement, this.name, '?');
    await this._run(stmt, [key]);
  }

  async reset() {
    const stmt = util.format(TruncateStatement, this.name);
    await this._run(stmt, {});
  }

  async keys() {
    const stmt = `SELECT key FROM ${this.name}`;
    const rows = await this._all(stmt);
    return rows.map(row => row.key);
  }

  async mset(pairs, options) {
    const ttl = (options.ttl || this.default_ttl) * 1000;
    const ts = now();
    const expire = ts + ttl;
    const bindings = pairs
      .map(([key, value]) => [key, this._serialize(value), ts, expire])
      .flat();
    const placeholders = pairs.map(() => generatePlaceHolders(4)).join(', ');
    const stmt = util.format(UpsertManyStatementPrefix + placeholders, this.name);
    await this._run(stmt, bindings);
  }

  async mget(...keys) {
    const ts = now();
    const rows = await this._fetch_all(keys);
    return rows.map(row => (row.expire_at > ts ? this._deserialize(row.val) : undefined));
  }

  async mdel(...keys) {
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = util.format(DeleteStatement, this.name, placeholders);
    await this._run(stmt, keys);
  }

  async _fetch_all(keys) {
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = `SELECT * FROM ${this.name} WHERE key IN (${placeholders})`;
    return this._all(stmt, keys);
  }

  async purgeExpired() {
    const stmt = util.format(PurgeExpiredStatement, this.name);
    await this._run(stmt, { $ts: now() });
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

  _run(stmt, params) {
    return new Promise((resolve, reject) => {
      this.db.run(stmt, params, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  _all(stmt, params) {
    return new Promise((resolve, reject) => {
      this.db.all(stmt, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

export default {
  create: config => new SqliteCacheStore(config),
};
