import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile('prisma/schema.prisma', 'utf8');
const schemas = {};
const enums = {};
for (const [, name, body] of source.matchAll(/enum (\w+)\s*\{([^}]+)\}/g))
  enums[name] = body.trim().split(/\s+/);
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const array = (name) => ({ type: 'array', items: ref(name) });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const number = { type: 'integer' };
const decimal = {
  type: 'string',
  pattern: '^-?\\d+(\\.\\d+)?$',
  example: '12500.50',
  description: 'Exact decimal; never parse money as JavaScript Number',
};
const excluded = new Set(['Session', 'PasswordReset', 'EmailOutbox', 'EmployeeBankDetails']);
const hidden = new Set(['passwordHash', 'storageKey']);
for (const [, name, body] of source.matchAll(/model (\w+)\s*\{([\s\S]*?)^\}/gm)) {
  if (excluded.has(name)) continue;
  const properties = {};
  for (const line of body.split('\n')) {
    const m = line.trim().match(/^(\w+)\s+(\w+)(\[\]|\?)?(.*)$/);
    if (!m) continue;
    const [, field, type, suffix, attrs] = m;
    if (hidden.has(field)) continue;
    let s;
    if (type === 'String') s = attrs.includes('@db.Uuid') ? { ...uuid } : { ...string };
    else if (type === 'Int') s = { ...number };
    else if (type === 'Boolean') s = { type: 'boolean' };
    else if (type === 'DateTime')
      s = {
        type: 'string',
        format: 'date-time',
        description: attrs.includes('@db.Date')
          ? 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD'
          : undefined,
      };
    else if (type === 'Decimal') s = { ...decimal };
    else if (type === 'Json') s = { type: 'object', additionalProperties: true };
    else if (enums[type]) s = { type: 'string', enum: enums[type] };
    else continue;
    if (suffix === '[]') s = { type: 'array', items: s };
    if (suffix === '?') s.nullable = true;
    properties[field] = s;
  }
  schemas[name] = object(properties);
}
const extend = (name, fields, required = []) => {
  schemas[name].properties = { ...schemas[name].properties, ...fields };
  schemas[name].required.push(...required);
};
schemas.Master = schemas.Branch;
schemas.Result = object({ message: string });
schemas.SessionResponse = object({ message: string, csrfToken: string });
schemas.CurrentUser = object({
  id: uuid,
  email: { type: 'string', format: 'email' },
  employeeId: { ...uuid, nullable: true },
  roles: { type: 'array', items: string },
  permissions: { type: 'array', items: string },
});
schemas.PageMeta = object({ total: number, page: number, limit: number, pages: number });
schemas.ApiError = object({
  statusCode: number,
  error: string,
  message: string,
  details: { type: 'array', items: {} },
  requestId: string,
});
schemas.Health = object({ status: string, database: string, redis: string }, ['status']);
schemas.EmployeeSummary = object({
  id: uuid,
  employeeCode: string,
  firstName: string,
  lastName: string,
});
extend(
  'Employee',
  {
    department: ref('Department'),
    designation: ref('Designation'),
    branch: ref('Branch'),
    shift: ref('Shift'),
    employment: ref('EmployeeEmploymentDetails'),
    manager: { ...ref('EmployeeSummary'), nullable: true },
  },
  ['department', 'designation', 'branch', 'shift', 'employment', 'manager'],
);
schemas.EmployeeHistory.properties.metadata = { type: 'object', additionalProperties: true };
schemas.PrivateProfile = object({
  id: uuid,
  personal: { ...ref('EmployeePersonalDetails'), nullable: true },
  addresses: array('EmployeeAddress'),
  emergencyContacts: array('EmployeeEmergencyContact'),
  education: array('EmployeeEducation'),
  experience: array('EmployeeExperience'),
});
schemas.PersonalDetails = schemas.EmployeePersonalDetails;
schemas.Address = schemas.EmployeeAddress;
schemas.EmergencyContact = schemas.EmployeeEmergencyContact;
schemas.Education = schemas.EmployeeEducation;
schemas.Experience = schemas.EmployeeExperience;
schemas.BankResult = object({
  bank: {
    ...object({
      employeeId: uuid,
      accountLast4: string,
      accountHolder: string,
      bankName: string,
      ifsc: string,
      updatedAt: { type: 'string', format: 'date-time' },
    }),
    nullable: true,
  },
});
schemas.BankUpdate = object({ message: string, accountLast4: string });
schemas.User = object({
  id: uuid,
  email: string,
  active: { type: 'boolean' },
  employeeId: { ...uuid, nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  roles: { type: 'array', items: object({ role: object({ name: string }) }) },
});
extend(
  'Role',
  {
    permissions: {
      type: 'array',
      items: object({ roleId: uuid, permissionId: uuid, permission: ref('Permission') }),
    },
  },
  ['permissions'],
);
schemas.RolesResult = object({ items: array('Role') });
schemas.PermissionsResult = object({ items: array('Permission') });
schemas.Regularization = schemas.AttendanceRegularization;
schemas.PunchResult = object({ punch: ref('RawPunch'), attendance: ref('Attendance') });
schemas.AttendanceResult = object({ items: array('Attendance') });
schemas.ImportResult = object({ inserted: number, duplicates: number, recalculated: number });
extend('LeaveType', { policies: array('LeavePolicy') });
schemas.LeaveTypesResult = object({ items: array('LeaveType') });
schemas.AllocationResult = object({ created: number });
extend('LeaveBalance', { leaveType: ref('LeaveType'), available: decimal }, [
  'leaveType',
  'available',
]);
schemas.LeaveRequest.properties.dates = {
  type: 'array',
  items: { type: 'string', format: 'date' },
};
extend('LeaveRequest', { leaveType: ref('LeaveType'), approvals: array('LeaveApproval') });
extend('SalaryRule', { component: ref('SalaryComponent') }, ['component']);
extend('SalaryStructure', { rules: array('SalaryRule') }, ['rules']);
schemas.SalaryComponentsResult = object({ items: array('SalaryComponent') });
schemas.SalaryAssignment = schemas.EmployeeSalaryStructure;
extend('SalaryAssignment', { structure: ref('SalaryStructure') });
schemas.SalaryAssignmentsResult = object({ items: array('SalaryAssignment') });
extend('PayrollRun', { period: ref('PayrollPeriod') }, ['period']);
schemas.PayslipMetadata = structuredClone(schemas.Payslip);
extend('PayrollEmployee', {
  components: array('PayrollComponent'),
  payslip: { ...ref('PayslipMetadata'), nullable: true },
  run: ref('PayrollRun'),
});
schemas.PayrollRunDetail = {
  allOf: [
    ref('PayrollRun'),
    object({ inputs: array('PayrollInput'), employees: array('PayrollEmployee') }),
  ],
};
extend('Payslip', { payrollEmployee: ref('PayrollEmployee') }, ['payrollEmployee']);
extend('LifecycleCase', { tasks: array('ChecklistTask') }, ['tasks']);
schemas.BinaryDocument = { type: 'string', format: 'binary' };
schemas.PrintDocument = { type: 'string', description: 'Complete printable HTML document' };
schemas.CsvDocument = {
  type: 'string',
  description: 'UTF-8 CSV, with BOM and escaped spreadsheet formulas',
};
schemas.HeadcountReport = object({
  total: number,
  department: { type: 'array', items: object({ id: uuid, name: string, count: number }) },
  branch: { type: 'array', items: object({ id: uuid, name: string, count: number }) },
  status: { type: 'array', items: object({ status: string, count: number }) },
});
schemas.AttendanceReport = object({
  items: {
    type: 'array',
    items: object({
      status: string,
      count: number,
      workingMinutes: { ...number, nullable: true },
      lateMinutes: { ...number, nullable: true },
      earlyMinutes: { ...number, nullable: true },
      overtimeMinutes: { ...number, nullable: true },
    }),
  },
});
schemas.LeaveReport = object({
  items: {
    type: 'array',
    items: object({ status: string, leaveType: string, count: number, days: decimal }),
  },
});
schemas.PayrollReport = object({
  items: {
    type: 'array',
    items: object({
      runId: uuid,
      year: number,
      month: number,
      status: string,
      employees: number,
      gross: decimal,
      deductions: decimal,
      net: decimal,
      employerCost: decimal,
    }),
  },
});
await writeFile(
  'src/common/response-schemas.ts',
  `import type { SchemaObject } from '@nestjs/swagger';\n// Generated from the explicit public response contract. Rebuild with node scripts/build-response-contract.mjs.\nexport const responseSchemas:Record<string,SchemaObject> = ${JSON.stringify(schemas, null, 2)};\n`,
);
console.log(`Generated ${Object.keys(schemas).length} public response schemas`);
