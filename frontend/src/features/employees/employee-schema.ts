import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{7,16}$/, 'Enter a valid phone number');
const today = () => new Date().toISOString().slice(0, 10);

export const employeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(1, 'Enter the employee code')
    .regex(/^[A-Za-z0-9-]*$/, 'Use letters, numbers and hyphens only'),
  firstName: z.string().trim().min(1, 'Enter the first name'),
  lastName: z.string().trim().min(1, 'Enter the last name'),
  email: z.string().trim().min(1, 'Enter the email address').email('Enter a valid email address'),
  phone,
  dateOfBirth: z
    .string()
    .min(1, 'Select the date of birth')
    .refine((v) => v < today(), 'Date of birth must be in the past'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Select a gender' }),
  departmentId: z.string().min(1, 'Select a department'),
  designationId: z.string().min(1, 'Select a designation'),
  branchId: z.string().min(1, 'Select a branch'),
  shiftId: z.string().min(1, 'Select a shift'),
  managerId: z.string().nullable(),
  joiningDate: z.string().min(1, 'Select the joining date'),
  status: z.enum(['ACTIVE', 'ON_NOTICE', 'INACTIVE'], { message: 'Select a status' }),
  address: z.string().trim().min(1, 'Enter the address'),
  emergencyContactName: z.string().trim().min(1, 'Enter the emergency contact name'),
  emergencyContactPhone: phone,
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
