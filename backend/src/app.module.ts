import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { BranchModule } from './branches/branches.module.js';
import { DepartmentModule } from './departments/departments.module.js';
import { DesignationModule } from './designations/designations.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { ShiftsModule } from './shifts/shifts.module.js';
import { HolidaysModule } from './holidays/holidays.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { LeaveModule } from './leave/leave.module.js';
import { SalaryModule } from './salary/salary.module.js';
import { PayrollModule } from './payroll/payroll.module.js';
import { PayslipsModule } from './payslips/payslips.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { LifecycleModule } from './onboarding/lifecycle.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AuditController } from './audit/audit.controller.js';
import { HealthController } from './health/health.controller.js';
@Module({
  imports: [
    CommonModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    BranchModule,
    DepartmentModule,
    DesignationModule,
    EmployeesModule,
    ShiftsModule,
    HolidaysModule,
    AttendanceModule,
    LeaveModule,
    SalaryModule,
    PayrollModule,
    PayslipsModule,
    DocumentsModule,
    LifecycleModule,
    ReportsModule,
  ],
  controllers: [AuditController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
