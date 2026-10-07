// Development-only in-memory data used by the mock layer.
import { format, subDays } from 'date-fns';
import type { EmployeeInput } from '../api/types';
import type { OrgRow } from '../api/crud';

const rows = (names: string[][], keys: string[]): OrgRow[] =>
  names.map(
    (n, i) =>
      ({ id: String(i + 1), ...Object.fromEntries(keys.map((k, j) => [k, n[j]])) }) as OrgRow,
  );

export const db = {
  departments: rows(
    [
      ['Engineering', 'ENG'],
      ['Human Resources', 'HR'],
      ['Finance', 'FIN'],
      ['Sales', 'SAL'],
      ['Operations', 'OPS'],
      ['Administration', 'ADM'],
    ],
    ['name', 'code'],
  ),
  designations: rows(
    [
      ['Software Engineer'],
      ['Senior Software Engineer'],
      ['Engineering Manager'],
      ['HR Executive'],
      ['Accounts Executive'],
      ['Sales Executive'],
      ['Operations Executive'],
      ['Office Administrator'],
    ],
    ['name'],
  ),
  branches: rows(
    [
      ['Head Office', 'New Delhi'],
      ['Noida Unit', 'Noida'],
      ['Pune Office', 'Pune'],
    ],
    ['name', 'city'],
  ),
  shifts: rows(
    [
      ['General', '09:30', '18:30'],
      ['Early', '07:00', '16:00'],
      ['Late', '12:00', '21:00'],
    ],
    ['name', 'startTime', 'endTime'],
  ),
  holidays: rows(
    [
      ['Gandhi Jayanti', '2026-10-02', 'PUBLIC'],
      ['Dussehra', '2026-10-20', 'PUBLIC'],
      ['Diwali', '2026-11-08', 'PUBLIC'],
      ['Guru Nanak Jayanti', '2026-11-24', 'OPTIONAL'],
      ['Christmas', '2026-12-25', 'PUBLIC'],
      ['Republic Day', '2027-01-26', 'PUBLIC'],
      ['Holi', '2027-03-04', 'PUBLIC'],
    ],
    ['name', 'date', 'type'],
  ),
  leaveTypes: rows(
    [
      ['Casual Leave', 'CL', '12', 'PAID'],
      ['Sick Leave', 'SL', '8', 'PAID'],
      ['Earned Leave', 'EL', '15', 'PAID'],
      ['Loss of Pay', 'LOP', '0', 'UNPAID'],
    ],
    ['name', 'code', 'annualDays', 'paid'],
  ),
  employees: [] as (EmployeeInput & { id: string })[],
};

const FIRST = [
  'Aarav',
  'Diya',
  'Rohan',
  'Ananya',
  'Kabir',
  'Meera',
  'Arjun',
  'Isha',
  'Vivaan',
  'Saanvi',
  'Aditya',
  'Kavya',
  'Reyansh',
  'Nisha',
  'Dev',
  'Tara',
];
const LAST = [
  'Sharma',
  'Verma',
  'Gupta',
  'Nair',
  'Kapoor',
  'Mehta',
  'Iyer',
  'Reddy',
  'Singh',
  'Joshi',
  'Bose',
  'Malhotra',
  'Chopra',
  'Menon',
  'Pillai',
  'Saxena',
];
const DESIGNATIONS_BY_DEPT = [[0, 1, 2], [3], [4], [5], [6], [7]];

for (let i = 0; i < 64; i++) {
  const dept = i % 6;
  const options = DESIGNATIONS_BY_DEPT[dept];
  const first = FIRST[i % 16];
  const last = LAST[(i * 5 + Math.floor(i / 16)) % 16];
  const recent = i >= 60;
  db.employees.push({
    id: String(i + 1),
    employeeCode: `CIPL${String(i + 1).padStart(3, '0')}`,
    firstName: first,
    lastName: last,
    email: `${first}.${last}@cipl.test`.toLowerCase(),
    phone: `+91 98${String(76543210 + i * 1237).slice(0, 8)}`,
    dateOfBirth: format(new Date(1980 + (i % 20), (i * 3) % 12, 1 + ((i * 11) % 27)), 'yyyy-MM-dd'),
    gender: i % 3 === 0 ? 'FEMALE' : i % 3 === 1 ? 'MALE' : 'OTHER',
    departmentId: String(dept + 1),
    designationId: String(
      (i < 6 ? options[options.length - 1] : options[Math.floor(i / 6) % options.length]) + 1,
    ),
    branchId: String((i % 3) + 1),
    shiftId: String(i % 7 === 0 ? 2 : 1),
    managerId: i < 6 ? null : String((i % 6) + 1),
    joiningDate: recent
      ? format(subDays(new Date(), 5 * (i - 59)), 'yyyy-MM-dd')
      : format(new Date(2016 + (i % 10), (i * 5) % 12, 1 + ((i * 7) % 27)), 'yyyy-MM-dd'),
    status: i % 17 === 5 ? 'ON_NOTICE' : i % 23 === 9 ? 'INACTIVE' : 'ACTIVE',
    address: `${10 + i}, Sector ${1 + (i % 9)}, ${['New Delhi', 'Noida', 'Pune'][i % 3]}`,
    emergencyContactName: `${LAST[(i + 3) % 16]} ${FIRST[(i + 7) % 16]}`,
    emergencyContactPhone: `+91 97${String(12345678 + i * 911).slice(0, 8)}`,
  });
}

const rename = (id: string, first: string, last: string) => {
  const e = db.employees.find((x) => x.id === id)!;
  Object.assign(e, {
    firstName: first,
    lastName: last,
    email: `${first}.${last}@cipl.test`.toLowerCase(),
  });
};
rename('1', 'Vikram', 'Shah'); // manager login (Engineering head, has direct reports)
rename('2', 'Anita', 'Rao'); // HR login
rename('7', 'Neha', 'Iyer'); // employee login (reports to Vikram)

let seq = 1000;
export const nextId = () => String(++seq);
