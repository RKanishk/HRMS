export type MockResult = { status: number; data: unknown; headers?: Record<string, string> };
export const ok = (data: unknown, status = 200, headers?: Record<string, string>): MockResult => ({
  status,
  data,
  headers,
});
export const fail = (status: number, message: string): MockResult => ({
  status,
  data: { message, statusCode: status },
});

export function paginate<T>(items: T[], params: Record<string, unknown>) {
  const pageSize = Math.min(Number(params.pageSize) || 10, 100);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number(params.page) || 1, 1), totalPages);
  return {
    data: items.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total, totalPages },
  };
}
