export type Role = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface CurrentUser {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
}

export interface ApiErrorBody {
  message?: string | string[];
  details?: unknown[];
  statusCode?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export type Department = { id: string; name: string; code: string };
export type Designation = { id: string; name: string };
export type Branch = { id: string; name: string; city: string };
export type Shift = { id: string; name: string; startTime: string; endTime: string };
export type HolidayType = 'PUBLIC' | 'OPTIONAL';
export type Holiday = { id: string; name: string; date: string; type: HolidayType };

export type EmployeeStatus = 'ACTIVE' | 'ON_NOTICE' | 'INACTIVE';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface EmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  departmentId: string;
  designationId: string;
  branchId: string;
  shiftId: string;
  managerId: string | null;
  joiningDate: string;
  status: EmployeeStatus;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface Employee extends EmployeeInput {
  id: string;
}

export interface EmployeeListItem extends Employee {
  departmentName: string;
  designationName: string;
  branchName: string;
  shiftName: string;
  managerName: string | null;
}

export interface HrDashboard {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  newJoiners: number;
  pendingApprovals: { leave: number; regularization: number };
  departmentDistribution: { department: string; count: number }[];
  attendanceSummary: { date: string; present: number; absent: number; onLeave: number }[];
  upcomingHolidays: Holiday[];
}

export type AttendanceStatus =
  'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF';
export type AttendanceSummary = Record<AttendanceStatus, number>;
export interface AttendanceRecord {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  branchName: string;
  date: string;
  status: AttendanceStatus | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
}
export interface DailyAttendanceResponse extends Paginated<AttendanceRecord> {
  summary: AttendanceSummary;
}
export interface MonthlyAttendanceRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  days: (AttendanceStatus | null)[];
}
export interface MonthlyAttendanceResponse extends Paginated<MonthlyAttendanceRow> {
  month: string;
  daysInMonth: number;
}
export interface MyAttendanceDay {
  date: string;
  status: AttendanceStatus | null;
  checkIn: string | null;
  checkOut: string | null;
}
export interface MyAttendanceResponse {
  month: string;
  days: MyAttendanceDay[];
  summary: AttendanceSummary;
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface Regularization {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: RequestStatus;
  appliedOn: string;
  reviewerComment: string | null;
}
export interface RegularizationInput {
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}

export type LeaveType = {
  id: string;
  name: string;
  code: string;
  annualDays: string;
  paid: string;
};
export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending: number;
  available: number;
}
export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: RequestStatus;
  appliedOn: string;
  reviewerComment: string | null;
  availableBalance: number | null;
}
export interface LeaveInput {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string;
}
export interface LeavePreview {
  days: number;
  available: number | null;
  sufficient: boolean;
  message: string | null;
}
export interface LeaveCalendarEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  status: RequestStatus;
}
export interface TeamMember extends EmployeeListItem {
  todayStatus: AttendanceStatus | null;
}

export type PayrollStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'LOCKED';
export interface PayrollPeriod {
  id: string;
  month: string;
  status: PayrollStatus;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}
export interface PayrollPeriodDetail extends PayrollPeriod {
  departmentSummary: { department: string; employees: number; totalNet: number }[];
}
export interface PayLine {
  label: string;
  amount: number;
}
export interface PayBreakdown {
  basic: number;
  allowances: number;
  bonus: number;
  overtime: number;
  gross: number;
  lopDays: number;
  lopDeduction: number;
  statutory: PayLine[];
  otherDeductions: PayLine[];
  totalDeductions: number;
  net: number;
}
export interface PayrollEntry extends PayBreakdown {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
}
export interface PayslipSummary {
  id: string;
  month: string;
  gross: number;
  net: number;
  publishedOn: string;
}
export interface Payslip extends PayBreakdown {
  id: string;
  month: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  designationName: string;
  publishedOn: string;
}

export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type DocumentType =
  'ID_PROOF' | 'ADDRESS_PROOF' | 'EDUCATION' | 'EXPERIENCE' | 'OFFER_LETTER' | 'OTHER';
export interface EmployeeDocument {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  documentType: DocumentType;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  status: DocumentStatus;
  reviewerComment: string | null;
}

export interface ChecklistItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string | null;
  done: boolean;
}
export interface ChecklistProcess {
  id: string;
  kind: 'ONBOARDING' | 'OFFBOARDING';
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  startDate: string;
  resignationDate: string | null;
  lastWorkingDay: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  items: ChecklistItem[];
}

export type NotificationType =
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'REGULARIZATION_APPROVED'
  | 'REGULARIZATION_REJECTED'
  | 'PAYSLIP_AVAILABLE'
  | 'GENERAL';
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href: string | null;
}
export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export type ReportKind = 'headcount' | 'attendance' | 'leave' | 'payroll';
export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
  money?: boolean;
}
export interface ReportResponse {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  totals: Record<string, string | number> | null;
}
