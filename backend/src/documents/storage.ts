import { Inject, Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV, type Environment } from '../config/env.js';
import { decrypt, encrypt } from '../common/crypto.js';
export abstract class ObjectStorage {
  abstract put(key: string, bytes: Buffer): Promise<void>;
  abstract get(key: string): Promise<Buffer>;
  abstract remove(key: string): Promise<void>;
}
@Injectable()
export class LocalObjectStorage extends ObjectStorage {
  constructor(@Inject(ENV) private env: Environment) {
    super();
  }
  private path(key: string) {
    if (!/^[0-9a-f-]{36}\.enc$/.test(key)) throw new Error('Invalid storage key');
    return join(this.env.STORAGE_PATH, 'documents', key);
  }
  async put(key: string, bytes: Buffer) {
    await mkdir(join(this.env.STORAGE_PATH, 'documents'), { recursive: true, mode: 0o700 });
    await writeFile(
      this.path(key),
      encrypt(bytes.toString('base64'), this.env.DATA_ENCRYPTION_KEY),
      { flag: 'wx', mode: 0o600 },
    );
  }
  async get(key: string) {
    return Buffer.from(
      decrypt(await readFile(this.path(key), 'utf8'), this.env.DATA_ENCRYPTION_KEY),
      'base64',
    );
  }
  async remove(key: string) {
    await unlink(this.path(key));
  }
}
