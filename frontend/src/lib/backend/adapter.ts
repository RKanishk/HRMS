// Real-backend layer at the network boundary (the counterpart of lib/mocks/adapter.ts).
// Screens keep calling the API contract in lib/api/*; this adapter turns each call into the
// NestJS backend's actual endpoints, parameters and response shapes (see handlers.ts).
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../api/client';
import { ROUTES, Res } from './handlers';
import { BackendNotSupported, call } from './http';

const parseBody = (data: unknown) => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = (config.url ?? '').split('?')[0];
  const body = parseBody(config.data);
  const route = ROUTES.find(([m, re]) => m === method && re.test(url));
  const query = (config.params ?? {}) as Record<string, unknown>;
  const respond = (res: Res) => ({
    data: res.data,
    status: res.status,
    statusText: String(res.status),
    headers: res.headers,
    config,
  });
  try {
    if (!route) {
      // Not part of the screens' contract: send it to the backend unchanged.
      const r = await call({
        method,
        url,
        params: query,
        data: body,
        responseType: config.responseType,
      });
      return { ...r, config };
    }
    const result = await route[2]({
      method,
      query,
      body,
      match: route[1].exec(url)!.slice(1),
      responseType: config.responseType,
    });
    return respond(result instanceof Res ? result : new Res(result));
  } catch (e) {
    if (e instanceof BackendNotSupported) {
      const response = {
        data: { message: e.message },
        status: e.status,
        statusText: String(e.status),
        headers: {},
        config,
      };
      throw new AxiosError(e.message, String(e.status), config, null, response);
    }
    if (axios.isAxiosError(e) && e.response) {
      // Re-issue the failure against the screen's own request so 401 handling sees the right URL.
      throw new AxiosError(e.message, e.code, config, e.request, { ...e.response, config });
    }
    throw e;
  }
};

export function installBackendAdapter() {
  apiClient.defaults.adapter = adapter;
}
