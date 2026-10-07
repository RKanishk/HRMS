import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ENV, type Environment } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../common/scope.service.js';
import { AuditService } from '../audit/audit.service.js';
import { encrypt } from '../common/crypto.js';
import { dateOnly } from '../common/dates.js';
import type { Principal } from '../auth/auth.types.js';
import {
  AddressDto,
  BankDto,
  EducationDto,
  EmergencyDto,
  ExperienceDto,
  PersonalDto,
} from './employees.dto.js';
@Injectable()
export class ProfileService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    @Inject(ENV) private env: Environment,
  ) {}
  async get(u: Principal, id: string) {
    await this.scope.employee(u, id, true);
    return this.db.employee.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        personal: true,
        addresses: true,
        emergencyContacts: true,
        education: true,
        experience: true,
      },
    });
  }
  async bank(u: Principal, id: string) {
    await this.scope.employee(u, id, true);
    return this.db.atomic(async (tx) => {
      const result = await tx.employeeBankDetails.findUnique({
        where: { employeeId: id },
        select: {
          employeeId: true,
          accountLast4: true,
          accountHolder: true,
          bankName: true,
          ifsc: true,
          updatedAt: true,
        },
      });
      await this.audit.write(tx, u.id, 'employee.bank_viewed', 'Employee', id);
      return { bank: result };
    });
  }
  personal(u: Principal, id: string, d: PersonalDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, id, true, tx);
      if (d.dateOfBirth && dateOnly(d.dateOfBirth) > new Date())
        throw new BadRequestException('Date of birth cannot be in the future');
      const data = { ...d, dateOfBirth: d.dateOfBirth ? dateOnly(d.dateOfBirth) : undefined };
      const row = await tx.employeePersonalDetails.upsert({
        where: { employeeId: id },
        create: { employeeId: id, ...data },
        update: data,
      });
      await this.audit.write(tx, u.id, 'employee.personal_updated', 'Employee', id, undefined, {
        fields: Object.keys(d),
      });
      return row;
    });
  }
  setBank(u: Principal, id: string, d: BankDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, id, true, tx);
      const { accountNumber, ...rest } = d;
      const data = {
        ...rest,
        accountCiphertext: encrypt(accountNumber, this.env.DATA_ENCRYPTION_KEY),
        accountLast4: accountNumber.slice(-4),
      };
      await tx.employeeBankDetails.upsert({
        where: { employeeId: id },
        create: { employeeId: id, ...data },
        update: data,
      });
      await this.audit.write(tx, u.id, 'employee.bank_updated', 'Employee', id, undefined, {
        accountLast4: data.accountLast4,
      });
      return { message: 'Bank details updated', accountLast4: data.accountLast4 };
    });
  }
  address(u: Principal, id: string, d: AddressDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, id, true, tx);
      const row = await tx.employeeAddress.upsert({
        where: { employeeId_type: { employeeId: id, type: d.type } },
        create: { employeeId: id, ...d },
        update: d,
      });
      await this.audit.write(tx, u.id, 'employee.address_updated', 'Employee', id, undefined, {
        type: d.type,
      });
      return row;
    });
  }
  emergency(u: Principal, id: string, d: EmergencyDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, id, true, tx);
      const row = await tx.employeeEmergencyContact.create({ data: { employeeId: id, ...d } });
      await this.audit.write(tx, u.id, 'employee.emergency_added', 'Employee', id);
      return row;
    });
  }
  education(u: Principal, id: string, d: EducationDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, id, true, tx);
      const row = await tx.employeeEducation.create({ data: { employeeId: id, ...d } });
      await this.audit.write(tx, u.id, 'employee.education_added', 'Employee', id);
      return row;
    });
  }
  experience(u: Principal, id: string, d: ExperienceDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, id, true, tx);
      if (d.endDate && dateOnly(d.endDate) < dateOnly(d.startDate))
        throw new BadRequestException('End date precedes start');
      const row = await tx.employeeExperience.create({
        data: {
          ...d,
          employeeId: id,
          startDate: dateOnly(d.startDate),
          endDate: d.endDate ? dateOnly(d.endDate) : undefined,
        },
      });
      await this.audit.write(tx, u.id, 'employee.experience_added', 'Employee', id);
      return row;
    });
  }
}
