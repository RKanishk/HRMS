import type { Request } from 'express';
export interface Principal {
  id: string;
  email: string;
  employeeId: string | null;
  roles: string[];
  permissions: string[];
  sessionId: string;
  csrfHash: string;
}
export interface AuthRequest extends Request {
  user: Principal;
  cookies: Record<string, string | undefined>;
}
