import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { createApp, openApi } from '../src/bootstrap.js';
const app = await createApp();
await mkdir('docs', { recursive: true });
await writeFile('docs/openapi.json', JSON.stringify(openApi(app), null, 2) + '\n');
await app.close();
console.log('Exported docs/openapi.json');
