import { z } from 'zod';
import { parseISO } from 'date-fns';
import type { CrudApi, OrgRow } from '@/lib/api/crud';
import {
  branchesApi,
  departmentsApi,
  designationsApi,
  holidaysApi,
  shiftsApi,
} from '@/lib/api/organization';
import { leaveTypesApi } from '@/lib/api/leave';
import { formatDate } from '@/lib/format';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'time' | 'date' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}
export interface EntityConfig {
  key: string;
  title: string;
  singular: string;
  description: string;
  api: CrudApi<OrgRow>;
  fields: FieldDef[];
  schema: z.ZodType;
  columns: { key: string; header: string; format?: (v: string) => string }[];
  sort?: (a: OrgRow, b: OrgRow) => number;
}

const req = (msg: string) => z.string().trim().min(1, msg);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time like 09:30');

export const ENTITIES: EntityConfig[] = [
  {
    key: 'departments',
    title: 'Departments',
    singular: 'department',
    description: 'Teams that employees belong to.',
    api: departmentsApi,
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'code', label: 'Code', type: 'text', placeholder: 'ENG' },
    ],
    schema: z.object({
      name: req('Enter a department name'),
      code: z
        .string()
        .trim()
        .min(2, 'Code needs 2 to 6 characters')
        .max(6, 'Code needs 2 to 6 characters'),
    }),
    columns: [
      { key: 'name', header: 'Department' },
      { key: 'code', header: 'Code' },
    ],
  },
  {
    key: 'designations',
    title: 'Designations',
    singular: 'designation',
    description: 'Job titles used across the company.',
    api: designationsApi,
    fields: [{ name: 'name', label: 'Title', type: 'text' }],
    schema: z.object({ name: req('Enter a designation title') }),
    columns: [{ key: 'name', header: 'Designation' }],
  },
  {
    key: 'branches',
    title: 'Branches',
    singular: 'branch',
    description: 'Offices and units where people work.',
    api: branchesApi,
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
    ],
    schema: z.object({ name: req('Enter a branch name'), city: req('Enter the city') }),
    columns: [
      { key: 'name', header: 'Branch' },
      { key: 'city', header: 'City' },
    ],
  },
  {
    key: 'shifts',
    title: 'Shifts',
    singular: 'shift',
    description: 'Working hours that attendance is measured against.',
    api: shiftsApi,
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'startTime', label: 'Start time', type: 'time' },
      { name: 'endTime', label: 'End time', type: 'time' },
    ],
    schema: z
      .object({ name: req('Enter a shift name'), startTime: time, endTime: time })
      .refine((v) => v.startTime !== v.endTime, {
        path: ['endTime'],
        message: 'End time must differ from start time',
      }),
    columns: [
      { key: 'name', header: 'Shift' },
      { key: 'startTime', header: 'Starts' },
      { key: 'endTime', header: 'Ends' },
    ],
  },
];

export const HOLIDAYS: EntityConfig = {
  key: 'holidays',
  title: 'Holidays',
  singular: 'holiday',
  description: 'Company holidays for the year.',
  api: holidaysApi,
  fields: [
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'date', label: 'Date', type: 'date' },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'PUBLIC', label: 'Public holiday' },
        { value: 'OPTIONAL', label: 'Optional holiday' },
      ],
    },
  ],
  schema: z.object({
    name: req('Enter a holiday name'),
    date: z
      .string()
      .min(1, 'Select a date')
      .refine((v) => !Number.isNaN(parseISO(v).getTime()), 'Select a valid date'),
    type: z.string().min(1, 'Select a type'),
  }),
  columns: [
    { key: 'name', header: 'Holiday' },
    { key: 'date', header: 'Date', format: formatDate },
    { key: 'type', header: 'Type', format: (v) => (v === 'PUBLIC' ? 'Public' : 'Optional') },
  ],
  sort: (a, b) => a.date.localeCompare(b.date),
};

export const findEntity = (key: string) => ENTITIES.find((e) => e.key === key);

export const LEAVE_TYPES: EntityConfig = {
  key: 'leave-types',
  title: 'Leave types',
  singular: 'leave type',
  description: 'Leave types and yearly entitlements. Balances are calculated by the backend.',
  api: leaveTypesApi,
  fields: [
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'code', label: 'Code', type: 'text', placeholder: 'CL' },
    { name: 'annualDays', label: 'Days per year', type: 'text', placeholder: '12' },
    {
      name: 'paid',
      label: 'Pay',
      type: 'select',
      options: [
        { value: 'PAID', label: 'Paid' },
        { value: 'UNPAID', label: 'Unpaid' },
      ],
    },
  ],
  schema: z.object({
    name: req('Enter a leave type name'),
    code: z
      .string()
      .trim()
      .min(2, 'Code needs 2 to 6 characters')
      .max(6, 'Code needs 2 to 6 characters'),
    annualDays: z
      .string()
      .trim()
      .regex(/^\d{1,3}$/, 'Enter a whole number of days'),
    paid: z.string().min(1, 'Select paid or unpaid'),
  }),
  columns: [
    { key: 'name', header: 'Leave type' },
    { key: 'code', header: 'Code' },
    { key: 'annualDays', header: 'Days per year' },
    { key: 'paid', header: 'Pay', format: (v) => (v === 'PAID' ? 'Paid' : 'Unpaid') },
  ],
};
