import type { Role } from './api/types';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  BarChart3,
  Building2,
  PartyPopper,
  FileText,
  Settings,
  UserRound,
  ClipboardCheck,
  UserPlus,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
}

const ALL: Role[] = ['HR_ADMIN', 'MANAGER', 'EMPLOYEE'];

// Frontend checks are UX only; the NestJS API enforces real authorization.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL },
  { label: 'My Profile', href: '/me/profile', icon: UserRound, roles: ['EMPLOYEE', 'MANAGER'] },
  { label: 'Employees', href: '/employees', icon: Users, roles: ['HR_ADMIN'] },
  { label: 'Onboarding', href: '/onboarding', icon: UserPlus, roles: ['HR_ADMIN'] },
  { label: 'Offboarding', href: '/offboarding', icon: UserMinus, roles: ['HR_ADMIN'] },
  { label: 'My Team', href: '/team', icon: Users, roles: ['MANAGER'] },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck, roles: ['HR_ADMIN'] },
  {
    label: 'My Attendance',
    href: '/me/attendance',
    icon: CalendarCheck,
    roles: ['EMPLOYEE', 'MANAGER'],
  },
  { label: 'Team Attendance', href: '/team/attendance', icon: CalendarCheck, roles: ['MANAGER'] },
  { label: 'Leave', href: '/leave', icon: CalendarDays, roles: ['HR_ADMIN'] },
  { label: 'My Leave', href: '/me/leave', icon: CalendarDays, roles: ['EMPLOYEE', 'MANAGER'] },
  { label: 'Approvals', href: '/team/approvals', icon: ClipboardCheck, roles: ['MANAGER'] },
  { label: 'Team Calendar', href: '/team/calendar', icon: CalendarDays, roles: ['MANAGER'] },
  { label: 'Payroll', href: '/payroll', icon: Wallet, roles: ['HR_ADMIN'] },
  { label: 'My Payslips', href: '/me/payslips', icon: Wallet, roles: ['EMPLOYEE', 'MANAGER'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['HR_ADMIN'] },
  { label: 'Organization', href: '/organization', icon: Building2, roles: ['HR_ADMIN'] },
  { label: 'Holidays', href: '/holidays', icon: PartyPopper, roles: ALL },
  { label: 'Documents', href: '/documents', icon: FileText, roles: ['HR_ADMIN'] },
  { label: 'My Documents', href: '/me/documents', icon: FileText, roles: ['EMPLOYEE', 'MANAGER'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['HR_ADMIN'] },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

/** A path is allowed if it matches (or is nested under) a nav item the role can see. Unknown paths are allowed to fall through to 404. */
export function canAccess(role: Role, pathname: string): boolean {
  const matches = NAV_ITEMS.filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
  if (matches.length === 0) return true;
  return matches.some((i) => i.roles.includes(role));
}
