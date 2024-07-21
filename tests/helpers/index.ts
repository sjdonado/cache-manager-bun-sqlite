import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export const getRandomPath = () =>
  join(tmpdir(), randomBytes(16).toString('hex') + '.db');
