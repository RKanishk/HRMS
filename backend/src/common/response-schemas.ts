import type { SchemaObject } from '@nestjs/swagger';
// Generated from the explicit public response contract. Rebuild with node scripts/build-response-contract.mjs.
export const responseSchemas: Record<string, SchemaObject> = {
  User: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      email: {
        type: 'string',
      },
      active: {
        type: 'boolean',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      roles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
              },
              required: ['name'],
            },
          },
          required: ['role'],
        },
      },
    },
    required: ['id', 'email', 'active', 'employeeId', 'createdAt', 'roles'],
  },
  Role: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      permissions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            roleId: {
              type: 'string',
              format: 'uuid',
            },
            permissionId: {
              type: 'string',
              format: 'uuid',
            },
            permission: {
              $ref: '#/components/schemas/Permission',
            },
          },
          required: ['roleId', 'permissionId', 'permission'],
        },
      },
    },
    required: ['id', 'name', 'permissions'],
  },
  Permission: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      code: {
        type: 'string',
      },
    },
    required: ['id', 'code'],
  },
  UserRole: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        format: 'uuid',
      },
      roleId: {
        type: 'string',
        format: 'uuid',
      },
    },
    required: ['userId', 'roleId'],
  },
  RolePermission: {
    type: 'object',
    properties: {
      roleId: {
        type: 'string',
        format: 'uuid',
      },
      permissionId: {
        type: 'string',
        format: 'uuid',
      },
    },
    required: ['roleId', 'permissionId'],
  },
  Branch: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      code: {
        type: 'string',
      },
      active: {
        type: 'boolean',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'name', 'code', 'active', 'createdAt', 'updatedAt'],
  },
  Department: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      code: {
        type: 'string',
      },
      active: {
        type: 'boolean',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'name', 'code', 'active', 'createdAt', 'updatedAt'],
  },
  Designation: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      code: {
        type: 'string',
      },
      active: {
        type: 'boolean',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'name', 'code', 'active', 'createdAt', 'updatedAt'],
  },
  Shift: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      startMinute: {
        type: 'integer',
      },
      endMinute: {
        type: 'integer',
      },
      graceMinutes: {
        type: 'integer',
      },
      halfDayMinutes: {
        type: 'integer',
      },
      fullDayMinutes: {
        type: 'integer',
      },
      weeklyOff: {
        type: 'array',
        items: {
          type: 'integer',
        },
      },
      active: {
        type: 'boolean',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: [
      'id',
      'name',
      'startMinute',
      'endMinute',
      'graceMinutes',
      'halfDayMinutes',
      'fullDayMinutes',
      'weeklyOff',
      'active',
      'createdAt',
      'updatedAt',
    ],
  },
  Holiday: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      date: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      branchId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'name', 'date', 'branchId', 'createdAt'],
  },
  Employee: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeCode: {
        type: 'string',
      },
      firstName: {
        type: 'string',
      },
      lastName: {
        type: 'string',
      },
      email: {
        type: 'string',
      },
      phone: {
        type: 'string',
        nullable: true,
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE', 'NOTICE_PERIOD', 'RESIGNED', 'TERMINATED'],
      },
      departmentId: {
        type: 'string',
        format: 'uuid',
      },
      designationId: {
        type: 'string',
        format: 'uuid',
      },
      branchId: {
        type: 'string',
        format: 'uuid',
      },
      shiftId: {
        type: 'string',
        format: 'uuid',
      },
      managerId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      joiningDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      confirmationDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      resignationDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      lastWorkingDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      department: {
        $ref: '#/components/schemas/Department',
      },
      designation: {
        $ref: '#/components/schemas/Designation',
      },
      branch: {
        $ref: '#/components/schemas/Branch',
      },
      shift: {
        $ref: '#/components/schemas/Shift',
      },
      employment: {
        $ref: '#/components/schemas/EmployeeEmploymentDetails',
      },
      manager: {
        $ref: '#/components/schemas/EmployeeSummary',
        nullable: true,
      },
    },
    required: [
      'id',
      'employeeCode',
      'firstName',
      'lastName',
      'email',
      'phone',
      'status',
      'departmentId',
      'designationId',
      'branchId',
      'shiftId',
      'managerId',
      'joiningDate',
      'confirmationDate',
      'resignationDate',
      'lastWorkingDate',
      'createdAt',
      'updatedAt',
      'department',
      'designation',
      'branch',
      'shift',
      'employment',
      'manager',
    ],
  },
  EmployeePersonalDetails: {
    type: 'object',
    properties: {
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      dateOfBirth: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      gender: {
        type: 'string',
        nullable: true,
      },
      bloodGroup: {
        type: 'string',
        nullable: true,
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['employeeId', 'dateOfBirth', 'gender', 'bloodGroup', 'updatedAt'],
  },
  EmployeeEmploymentDetails: {
    type: 'object',
    properties: {
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      employmentType: {
        type: 'string',
      },
      probationMonths: {
        type: 'integer',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['employeeId', 'employmentType', 'probationMonths', 'updatedAt'],
  },
  EmployeeAddress: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      type: {
        type: 'string',
      },
      line1: {
        type: 'string',
      },
      city: {
        type: 'string',
      },
      state: {
        type: 'string',
      },
      postalCode: {
        type: 'string',
      },
      country: {
        type: 'string',
      },
    },
    required: ['id', 'employeeId', 'type', 'line1', 'city', 'state', 'postalCode', 'country'],
  },
  EmployeeEmergencyContact: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      relationship: {
        type: 'string',
      },
      phone: {
        type: 'string',
      },
    },
    required: ['id', 'employeeId', 'name', 'relationship', 'phone'],
  },
  EmployeeEducation: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      institution: {
        type: 'string',
      },
      qualification: {
        type: 'string',
      },
      completionYear: {
        type: 'integer',
      },
    },
    required: ['id', 'employeeId', 'institution', 'qualification', 'completionYear'],
  },
  EmployeeExperience: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      employer: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
    },
    required: ['id', 'employeeId', 'employer', 'title', 'startDate', 'endDate'],
  },
  EmployeeHistory: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      action: {
        type: 'string',
      },
      actorId: {
        type: 'string',
        format: 'uuid',
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'employeeId', 'action', 'actorId', 'metadata', 'createdAt'],
  },
  RawPunch: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      occurredAt: {
        type: 'string',
        format: 'date-time',
      },
      direction: {
        type: 'string',
      },
      source: {
        type: 'string',
      },
      externalId: {
        type: 'string',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'employeeId', 'occurredAt', 'direction', 'source', 'externalId', 'createdAt'],
  },
  Attendance: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      date: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      status: {
        type: 'string',
        enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF'],
      },
      checkIn: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      checkOut: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      workingMinutes: {
        type: 'integer',
      },
      lateMinutes: {
        type: 'integer',
      },
      earlyMinutes: {
        type: 'integer',
      },
      overtimeMinutes: {
        type: 'integer',
      },
      source: {
        type: 'string',
      },
      shiftSnapshot: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: [
      'id',
      'employeeId',
      'date',
      'status',
      'checkIn',
      'checkOut',
      'workingMinutes',
      'lateMinutes',
      'earlyMinutes',
      'overtimeMinutes',
      'source',
      'shiftSnapshot',
      'updatedAt',
    ],
  },
  AttendanceRegularization: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      date: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      checkIn: {
        type: 'string',
        format: 'date-time',
      },
      checkOut: {
        type: 'string',
        format: 'date-time',
      },
      reason: {
        type: 'string',
      },
      status: {
        type: 'string',
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      },
      reviewerId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      reviewNote: {
        type: 'string',
        nullable: true,
      },
      reviewedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: [
      'id',
      'employeeId',
      'date',
      'checkIn',
      'checkOut',
      'reason',
      'status',
      'reviewerId',
      'reviewNote',
      'reviewedAt',
      'createdAt',
    ],
  },
  LeaveType: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      code: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      paid: {
        type: 'boolean',
      },
      active: {
        type: 'boolean',
      },
      policies: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/LeavePolicy',
        },
      },
    },
    required: ['id', 'code', 'name', 'paid', 'active'],
  },
  LeavePolicy: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      leaveTypeId: {
        type: 'string',
        format: 'uuid',
      },
      year: {
        type: 'integer',
      },
      annualEntitlement: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      carryForwardLimit: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
    },
    required: ['id', 'leaveTypeId', 'year', 'annualEntitlement', 'carryForwardLimit'],
  },
  LeaveBalance: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      leaveTypeId: {
        type: 'string',
        format: 'uuid',
      },
      year: {
        type: 'integer',
      },
      entitled: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      used: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      reserved: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      leaveType: {
        $ref: '#/components/schemas/LeaveType',
      },
      available: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
    },
    required: [
      'id',
      'employeeId',
      'leaveTypeId',
      'year',
      'entitled',
      'used',
      'reserved',
      'leaveType',
      'available',
    ],
  },
  LeaveRequest: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      leaveTypeId: {
        type: 'string',
        format: 'uuid',
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      days: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      dates: {
        type: 'array',
        items: {
          type: 'string',
          format: 'date',
        },
      },
      reason: {
        type: 'string',
      },
      status: {
        type: 'string',
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      leaveType: {
        $ref: '#/components/schemas/LeaveType',
      },
      approvals: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/LeaveApproval',
        },
      },
    },
    required: [
      'id',
      'employeeId',
      'leaveTypeId',
      'startDate',
      'endDate',
      'days',
      'dates',
      'reason',
      'status',
      'createdAt',
      'updatedAt',
    ],
  },
  LeaveApproval: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      leaveRequestId: {
        type: 'string',
        format: 'uuid',
      },
      approverId: {
        type: 'string',
        format: 'uuid',
      },
      decision: {
        type: 'string',
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      },
      note: {
        type: 'string',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'leaveRequestId', 'approverId', 'decision', 'note', 'createdAt'],
  },
  SalaryComponent: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      code: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      kind: {
        type: 'string',
        enum: ['EARNING', 'DEDUCTION', 'EMPLOYER'],
      },
      statutory: {
        type: 'boolean',
      },
      active: {
        type: 'boolean',
      },
    },
    required: ['id', 'code', 'name', 'kind', 'statutory', 'active'],
  },
  SalaryStructure: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      version: {
        type: 'integer',
      },
      effectiveFrom: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      rules: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/SalaryRule',
        },
      },
    },
    required: ['id', 'name', 'version', 'effectiveFrom', 'createdAt', 'rules'],
  },
  SalaryRule: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      structureId: {
        type: 'string',
        format: 'uuid',
      },
      componentId: {
        type: 'string',
        format: 'uuid',
      },
      method: {
        type: 'string',
        enum: ['FIXED', 'PERCENT_BASIC', 'PERCENT_GROSS'],
      },
      value: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      wageCap: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
        nullable: true,
      },
      eligibilityGrossMax: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
        nullable: true,
      },
      prorate: {
        type: 'boolean',
      },
      component: {
        $ref: '#/components/schemas/SalaryComponent',
      },
    },
    required: [
      'id',
      'structureId',
      'componentId',
      'method',
      'value',
      'wageCap',
      'eligibilityGrossMax',
      'prorate',
      'component',
    ],
  },
  EmployeeSalaryStructure: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      structureId: {
        type: 'string',
        format: 'uuid',
      },
      effectiveFrom: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      structure: {
        $ref: '#/components/schemas/SalaryStructure',
      },
    },
    required: ['id', 'employeeId', 'structureId', 'effectiveFrom', 'createdAt'],
  },
  PayrollPeriod: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      year: {
        type: 'integer',
      },
      month: {
        type: 'integer',
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
    },
    required: ['id', 'year', 'month', 'startDate', 'endDate'],
  },
  PayrollRun: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      periodId: {
        type: 'string',
        format: 'uuid',
      },
      status: {
        type: 'string',
        enum: ['OPEN', 'CALCULATING', 'REVIEW', 'APPROVED', 'LOCKED'],
      },
      processedBy: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      approvedBy: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      approvedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      lockedBy: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      lockedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      period: {
        $ref: '#/components/schemas/PayrollPeriod',
      },
    },
    required: [
      'id',
      'periodId',
      'status',
      'processedBy',
      'approvedBy',
      'approvedAt',
      'lockedBy',
      'lockedAt',
      'createdAt',
      'updatedAt',
      'period',
    ],
  },
  PayrollInput: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      runId: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      code: {
        type: 'string',
      },
      kind: {
        type: 'string',
        enum: ['EARNING', 'DEDUCTION', 'EMPLOYER'],
      },
      amount: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      note: {
        type: 'string',
      },
    },
    required: ['id', 'runId', 'employeeId', 'code', 'kind', 'amount', 'note'],
  },
  PayrollEmployee: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      runId: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      paidDays: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      lopDays: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      gross: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      deductions: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      net: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      employerCost: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      snapshot: {
        type: 'object',
        additionalProperties: true,
      },
      components: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/PayrollComponent',
        },
      },
      payslip: {
        $ref: '#/components/schemas/PayslipMetadata',
        nullable: true,
      },
      run: {
        $ref: '#/components/schemas/PayrollRun',
      },
    },
    required: [
      'id',
      'runId',
      'employeeId',
      'paidDays',
      'lopDays',
      'gross',
      'deductions',
      'net',
      'employerCost',
      'snapshot',
    ],
  },
  PayrollComponent: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      payrollEmployeeId: {
        type: 'string',
        format: 'uuid',
      },
      code: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      kind: {
        type: 'string',
        enum: ['EARNING', 'DEDUCTION', 'EMPLOYER'],
      },
      amount: {
        type: 'string',
        pattern: '^-?\\d+(\\.\\d+)?$',
        example: '12500.50',
        description: 'Exact decimal; never parse money as JavaScript Number',
      },
      ruleSnapshot: {
        type: 'object',
        additionalProperties: true,
      },
    },
    required: ['id', 'payrollEmployeeId', 'code', 'name', 'kind', 'amount', 'ruleSnapshot'],
  },
  Payslip: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      payrollEmployeeId: {
        type: 'string',
        format: 'uuid',
      },
      publishedAt: {
        type: 'string',
        format: 'date-time',
      },
      payrollEmployee: {
        $ref: '#/components/schemas/PayrollEmployee',
      },
    },
    required: ['id', 'payrollEmployeeId', 'publishedAt', 'payrollEmployee'],
  },
  EmployeeDocument: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      category: {
        type: 'string',
      },
      originalName: {
        type: 'string',
      },
      mimeType: {
        type: 'string',
      },
      size: {
        type: 'integer',
      },
      sha256: {
        type: 'string',
      },
      uploadedBy: {
        type: 'string',
        format: 'uuid',
      },
      deletedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: [
      'id',
      'employeeId',
      'category',
      'originalName',
      'mimeType',
      'size',
      'sha256',
      'uploadedBy',
      'deletedAt',
      'createdAt',
    ],
  },
  LifecycleCase: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      kind: {
        type: 'string',
      },
      status: {
        type: 'string',
      },
      resignationDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      lastWorkingDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      completedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      tasks: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ChecklistTask',
        },
      },
    },
    required: [
      'id',
      'employeeId',
      'kind',
      'status',
      'resignationDate',
      'lastWorkingDate',
      'createdAt',
      'completedAt',
      'tasks',
    ],
  },
  ChecklistTask: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      caseId: {
        type: 'string',
        format: 'uuid',
      },
      label: {
        type: 'string',
      },
      required: {
        type: 'boolean',
      },
      completed: {
        type: 'boolean',
      },
      completedBy: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      completedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
    },
    required: ['id', 'caseId', 'label', 'required', 'completed', 'completedBy', 'completedAt'],
  },
  Notification: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      userId: {
        type: 'string',
        format: 'uuid',
      },
      event: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      entityId: {
        type: 'string',
        nullable: true,
      },
      readAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'userId', 'event', 'title', 'entityId', 'readAt', 'createdAt'],
  },
  AuditLog: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      actorId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      action: {
        type: 'string',
      },
      entityType: {
        type: 'string',
      },
      entityId: {
        type: 'string',
      },
      before: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
      },
      after: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'actorId', 'action', 'entityType', 'entityId', 'before', 'after', 'createdAt'],
  },
  Master: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      code: {
        type: 'string',
      },
      active: {
        type: 'boolean',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'name', 'code', 'active', 'createdAt', 'updatedAt'],
  },
  Result: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
      },
    },
    required: ['message'],
  },
  SessionResponse: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
      },
      csrfToken: {
        type: 'string',
      },
    },
    required: ['message', 'csrfToken'],
  },
  CurrentUser: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      email: {
        type: 'string',
        format: 'email',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      roles: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      permissions: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    required: ['id', 'email', 'employeeId', 'roles', 'permissions'],
  },
  PageMeta: {
    type: 'object',
    properties: {
      total: {
        type: 'integer',
      },
      page: {
        type: 'integer',
      },
      limit: {
        type: 'integer',
      },
      pages: {
        type: 'integer',
      },
    },
    required: ['total', 'page', 'limit', 'pages'],
  },
  ApiError: {
    type: 'object',
    properties: {
      statusCode: {
        type: 'integer',
      },
      error: {
        type: 'string',
      },
      message: {
        type: 'string',
      },
      details: {
        type: 'array',
        items: {},
      },
      requestId: {
        type: 'string',
      },
    },
    required: ['statusCode', 'error', 'message', 'details', 'requestId'],
  },
  Health: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
      },
      database: {
        type: 'string',
      },
      redis: {
        type: 'string',
      },
    },
    required: ['status'],
  },
  EmployeeSummary: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeCode: {
        type: 'string',
      },
      firstName: {
        type: 'string',
      },
      lastName: {
        type: 'string',
      },
    },
    required: ['id', 'employeeCode', 'firstName', 'lastName'],
  },
  PrivateProfile: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      personal: {
        $ref: '#/components/schemas/EmployeePersonalDetails',
        nullable: true,
      },
      addresses: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/EmployeeAddress',
        },
      },
      emergencyContacts: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/EmployeeEmergencyContact',
        },
      },
      education: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/EmployeeEducation',
        },
      },
      experience: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/EmployeeExperience',
        },
      },
    },
    required: ['id', 'personal', 'addresses', 'emergencyContacts', 'education', 'experience'],
  },
  PersonalDetails: {
    type: 'object',
    properties: {
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      dateOfBirth: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
      gender: {
        type: 'string',
        nullable: true,
      },
      bloodGroup: {
        type: 'string',
        nullable: true,
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['employeeId', 'dateOfBirth', 'gender', 'bloodGroup', 'updatedAt'],
  },
  Address: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      type: {
        type: 'string',
      },
      line1: {
        type: 'string',
      },
      city: {
        type: 'string',
      },
      state: {
        type: 'string',
      },
      postalCode: {
        type: 'string',
      },
      country: {
        type: 'string',
      },
    },
    required: ['id', 'employeeId', 'type', 'line1', 'city', 'state', 'postalCode', 'country'],
  },
  EmergencyContact: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      relationship: {
        type: 'string',
      },
      phone: {
        type: 'string',
      },
    },
    required: ['id', 'employeeId', 'name', 'relationship', 'phone'],
  },
  Education: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      institution: {
        type: 'string',
      },
      qualification: {
        type: 'string',
      },
      completionYear: {
        type: 'integer',
      },
    },
    required: ['id', 'employeeId', 'institution', 'qualification', 'completionYear'],
  },
  Experience: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      employer: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
        nullable: true,
      },
    },
    required: ['id', 'employeeId', 'employer', 'title', 'startDate', 'endDate'],
  },
  BankResult: {
    type: 'object',
    properties: {
      bank: {
        type: 'object',
        properties: {
          employeeId: {
            type: 'string',
            format: 'uuid',
          },
          accountLast4: {
            type: 'string',
          },
          accountHolder: {
            type: 'string',
          },
          bankName: {
            type: 'string',
          },
          ifsc: {
            type: 'string',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['employeeId', 'accountLast4', 'accountHolder', 'bankName', 'ifsc', 'updatedAt'],
        nullable: true,
      },
    },
    required: ['bank'],
  },
  BankUpdate: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
      },
      accountLast4: {
        type: 'string',
      },
    },
    required: ['message', 'accountLast4'],
  },
  RolesResult: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Role',
        },
      },
    },
    required: ['items'],
  },
  PermissionsResult: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Permission',
        },
      },
    },
    required: ['items'],
  },
  Regularization: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      date: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      checkIn: {
        type: 'string',
        format: 'date-time',
      },
      checkOut: {
        type: 'string',
        format: 'date-time',
      },
      reason: {
        type: 'string',
      },
      status: {
        type: 'string',
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      },
      reviewerId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
      },
      reviewNote: {
        type: 'string',
        nullable: true,
      },
      reviewedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: [
      'id',
      'employeeId',
      'date',
      'checkIn',
      'checkOut',
      'reason',
      'status',
      'reviewerId',
      'reviewNote',
      'reviewedAt',
      'createdAt',
    ],
  },
  PunchResult: {
    type: 'object',
    properties: {
      punch: {
        $ref: '#/components/schemas/RawPunch',
      },
      attendance: {
        $ref: '#/components/schemas/Attendance',
      },
    },
    required: ['punch', 'attendance'],
  },
  AttendanceResult: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Attendance',
        },
      },
    },
    required: ['items'],
  },
  ImportResult: {
    type: 'object',
    properties: {
      inserted: {
        type: 'integer',
      },
      duplicates: {
        type: 'integer',
      },
      recalculated: {
        type: 'integer',
      },
    },
    required: ['inserted', 'duplicates', 'recalculated'],
  },
  LeaveTypesResult: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/LeaveType',
        },
      },
    },
    required: ['items'],
  },
  AllocationResult: {
    type: 'object',
    properties: {
      created: {
        type: 'integer',
      },
    },
    required: ['created'],
  },
  SalaryComponentsResult: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/SalaryComponent',
        },
      },
    },
    required: ['items'],
  },
  SalaryAssignment: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      employeeId: {
        type: 'string',
        format: 'uuid',
      },
      structureId: {
        type: 'string',
        format: 'uuid',
      },
      effectiveFrom: {
        type: 'string',
        format: 'date-time',
        description: 'Date stored as UTC midnight; use first ten ISO characters as YYYY-MM-DD',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      structure: {
        $ref: '#/components/schemas/SalaryStructure',
      },
    },
    required: ['id', 'employeeId', 'structureId', 'effectiveFrom', 'createdAt'],
  },
  SalaryAssignmentsResult: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/SalaryAssignment',
        },
      },
    },
    required: ['items'],
  },
  PayslipMetadata: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      payrollEmployeeId: {
        type: 'string',
        format: 'uuid',
      },
      publishedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
    required: ['id', 'payrollEmployeeId', 'publishedAt'],
  },
  PayrollRunDetail: {
    allOf: [
      {
        $ref: '#/components/schemas/PayrollRun',
      },
      {
        type: 'object',
        properties: {
          inputs: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PayrollInput',
            },
          },
          employees: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PayrollEmployee',
            },
          },
        },
        required: ['inputs', 'employees'],
      },
    ],
  },
  BinaryDocument: {
    type: 'string',
    format: 'binary',
  },
  PrintDocument: {
    type: 'string',
    description: 'Complete printable HTML document',
  },
  CsvDocument: {
    type: 'string',
    description: 'UTF-8 CSV, with BOM and escaped spreadsheet formulas',
  },
  HeadcountReport: {
    type: 'object',
    properties: {
      total: {
        type: 'integer',
      },
      department: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            count: {
              type: 'integer',
            },
          },
          required: ['id', 'name', 'count'],
        },
      },
      branch: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            count: {
              type: 'integer',
            },
          },
          required: ['id', 'name', 'count'],
        },
      },
      status: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
            },
            count: {
              type: 'integer',
            },
          },
          required: ['status', 'count'],
        },
      },
    },
    required: ['total', 'department', 'branch', 'status'],
  },
  AttendanceReport: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
            },
            count: {
              type: 'integer',
            },
            workingMinutes: {
              type: 'integer',
              nullable: true,
            },
            lateMinutes: {
              type: 'integer',
              nullable: true,
            },
            earlyMinutes: {
              type: 'integer',
              nullable: true,
            },
            overtimeMinutes: {
              type: 'integer',
              nullable: true,
            },
          },
          required: [
            'status',
            'count',
            'workingMinutes',
            'lateMinutes',
            'earlyMinutes',
            'overtimeMinutes',
          ],
        },
      },
    },
    required: ['items'],
  },
  LeaveReport: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
            },
            leaveType: {
              type: 'string',
            },
            count: {
              type: 'integer',
            },
            days: {
              type: 'string',
              pattern: '^-?\\d+(\\.\\d+)?$',
              example: '12500.50',
              description: 'Exact decimal; never parse money as JavaScript Number',
            },
          },
          required: ['status', 'leaveType', 'count', 'days'],
        },
      },
    },
    required: ['items'],
  },
  PayrollReport: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            runId: {
              type: 'string',
              format: 'uuid',
            },
            year: {
              type: 'integer',
            },
            month: {
              type: 'integer',
            },
            status: {
              type: 'string',
            },
            employees: {
              type: 'integer',
            },
            gross: {
              type: 'string',
              pattern: '^-?\\d+(\\.\\d+)?$',
              example: '12500.50',
              description: 'Exact decimal; never parse money as JavaScript Number',
            },
            deductions: {
              type: 'string',
              pattern: '^-?\\d+(\\.\\d+)?$',
              example: '12500.50',
              description: 'Exact decimal; never parse money as JavaScript Number',
            },
            net: {
              type: 'string',
              pattern: '^-?\\d+(\\.\\d+)?$',
              example: '12500.50',
              description: 'Exact decimal; never parse money as JavaScript Number',
            },
            employerCost: {
              type: 'string',
              pattern: '^-?\\d+(\\.\\d+)?$',
              example: '12500.50',
              description: 'Exact decimal; never parse money as JavaScript Number',
            },
          },
          required: [
            'runId',
            'year',
            'month',
            'status',
            'employees',
            'gross',
            'deductions',
            'net',
            'employerCost',
          ],
        },
      },
    },
    required: ['items'],
  },
};
