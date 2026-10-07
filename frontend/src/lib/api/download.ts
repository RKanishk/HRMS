import axios from 'axios';
import { apiClient } from './client';

export interface Downloaded {
  blob: Blob;
  filename: string;
}

/** GET a file from the API. Error bodies arrive as blobs, so they are unpacked to keep the server's message. */
export async function fetchFile(
  url: string,
  params?: Record<string, unknown>,
  fallbackName = 'download',
): Promise<Downloaded> {
  try {
    const res = await apiClient.get<Blob>(url, { params, responseType: 'blob' });
    const cd = String(res.headers?.['content-disposition'] ?? '');
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { blob: res.data, filename: m ? decodeURIComponent(m[1]) : fallbackName };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      try {
        e.response.data = JSON.parse(await e.response.data.text());
      } catch {
        /* keep the original error */
      }
    }
    throw e;
  }
}

export function saveFile({ blob, filename }: Downloaded) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function openFile({ blob }: Downloaded, win: Window | null) {
  const href = URL.createObjectURL(blob);
  if (win) win.location.href = href;
  else window.open(href, '_blank');
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
