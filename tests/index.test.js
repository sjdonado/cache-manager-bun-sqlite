import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import sqliteStore from '../index.js';

describe('sqliteStore.create', () => {
  it('should create table of passed name for given db', done => {
    sqliteStore.create({
      name: 'foo',
      path: '/tmp/test.db',
      options: {
        onReady: () => {
          const db = new Database('/tmp/test.db');
          db.all(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='foo'`,
            [],
            (err, rows) => {
              expect(err).toBeNull();
              expect(rows.length).toBe(1);
              done();
            }
          );
        },
      },
    });
  });

  it('should not error if table already exists', done => {
    sqliteStore.create({
      name: 'fo1',
      path: '/tmp/test.db',
    });

    sqliteStore.create({
      name: 'fo1',
      path: '/tmp/test.db',
      options: {
        onReady: err => {
          expect(err).toBeNull();
          const db = new Database('/tmp/test.db');
          db.all(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='fo1'`,
            [],
            (err, rows) => {
              expect(err).toBeNull();
              expect(rows.length).toBe(1);
              done();
            }
          );
        },
      },
    });
  });
});
