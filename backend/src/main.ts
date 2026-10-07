import 'reflect-metadata';
import { createApp } from './bootstrap.js';
import { ENV, type Environment } from './config/env.js';
const app = await createApp();
const env = app.get<Environment>(ENV);
await app.listen(env.PORT, '0.0.0.0');
