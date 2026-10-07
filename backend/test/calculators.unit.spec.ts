import { describe, test, expect } from '@jest/globals';
import { calculateAttendance } from '../src/attendance/calculator.js';
import { calculatePayroll, type CalculationRule } from '../src/payroll/calculator.js';
import { encrypt, decrypt, hash, safeEqual } from '../src/common/crypto.js';
import { toCsv } from '../src/reports/reports.service.js';
import { documentMime } from '../src/documents/documents.service.js';
const shift = {
  startMinute: 540,
  endMinute: 1080,
  graceMinutes: 10,
  halfDayMinutes: 240,
  fullDayMinutes: 480,
  weeklyOff: [6, 7],
};
const date = new Date('2026-08-03T00:00:00Z');
const punch = (time: string, direction: string) => ({ occurredAt: new Date(time), direction });
describe('Attendance calculation', () => {
  test('deducts breaks and calculates late/early minutes', () => {
    const result = calculateAttendance(
      date,
      shift,
      [
        punch('2026-08-03T09:30:00+05:30', 'IN'),
        punch('2026-08-03T13:00:00+05:30', 'OUT'),
        punch('2026-08-03T14:00:00+05:30', 'IN'),
        punch('2026-08-03T17:30:00+05:30', 'OUT'),
      ],
      'Asia/Kolkata',
    );
    expect(result).toMatchObject({
      status: 'HALF_DAY',
      workingMinutes: 420,
      lateMinutes: 20,
      earlyMinutes: 30,
      overtimeMinutes: 0,
    });
  });
  test('full day and overtime', () =>
    expect(
      calculateAttendance(
        date,
        shift,
        [punch('2026-08-03T09:00:00+05:30', 'IN'), punch('2026-08-03T19:00:00+05:30', 'OUT')],
        'Asia/Kolkata',
      ),
    ).toMatchObject({ status: 'PRESENT', workingMinutes: 600, overtimeMinutes: 120 }));
  test('overnight shift', () =>
    expect(
      calculateAttendance(
        date,
        { ...shift, startMinute: 1320, endMinute: 360 },
        [punch('2026-08-03T22:00:00+05:30', 'IN'), punch('2026-08-04T06:00:00+05:30', 'OUT')],
        'Asia/Kolkata',
      ),
    ).toMatchObject({ status: 'PRESENT', workingMinutes: 480, earlyMinutes: 0 }));
  test('holiday, weekly off, leave and absence', () => {
    expect(calculateAttendance(date, shift, [], 'Asia/Kolkata', true).status).toBe('HOLIDAY');
    expect(calculateAttendance(new Date('2026-08-02Z'), shift, [], 'Asia/Kolkata').status).toBe(
      'WEEKLY_OFF',
    );
    expect(calculateAttendance(date, shift, [], 'Asia/Kolkata', false, true).status).toBe('LEAVE');
    expect(calculateAttendance(date, shift, [], 'Asia/Kolkata').status).toBe('ABSENT');
  });
  test('rejects unmatched and duplicate punches', () => {
    expect(() =>
      calculateAttendance(date, shift, [punch('2026-08-03T18:00:00+05:30', 'OUT')], 'Asia/Kolkata'),
    ).toThrow();
    expect(() =>
      calculateAttendance(
        date,
        shift,
        [punch('2026-08-03T09:00:00+05:30', 'IN'), punch('2026-08-03T10:00:00+05:30', 'IN')],
        'Asia/Kolkata',
      ),
    ).toThrow();
  });
  test('open check-in is provisional', () =>
    expect(
      calculateAttendance(date, shift, [punch('2026-08-03T09:00:00+05:30', 'IN')], 'Asia/Kolkata'),
    ).toMatchObject({ checkOut: null, status: 'ABSENT' }));
});
const rules: CalculationRule[] = [
  { code: 'BASIC', name: 'Basic', kind: 'EARNING', method: 'FIXED', value: '30000', prorate: true },
  {
    code: 'HRA',
    name: 'Allowance',
    kind: 'EARNING',
    method: 'PERCENT_BASIC',
    value: '40',
    prorate: true,
  },
  {
    code: 'EXAMPLE_RATE',
    name: 'Synthetic rate test',
    kind: 'DEDUCTION',
    method: 'PERCENT_BASIC',
    value: '12',
    prorate: true,
    wageCap: '15000',
  },
];
describe('Decimal payroll arithmetic', () => {
  test('exact gross and capped deduction', () => {
    const p = calculatePayroll(rules, 30, 30, '0');
    expect(p.gross.toFixed(2)).toBe('42000.00');
    expect(p.deductions.toFixed(2)).toBe('1800.00');
    expect(p.net.toFixed(2)).toBe('40200.00');
  });
  test('loss of pay and one-time reimbursement', () => {
    const p = calculatePayroll(rules, 30, 30, '1.5', [
      { code: 'REIMBURSEMENT', kind: 'EARNING', amount: '100.10', note: 'Receipt reviewed' },
    ]);
    expect(p.gross.toFixed(2)).toBe('42100.10');
    expect(p.lines.find((l) => l.code === 'LOP')!.amount.toFixed(2)).toBe('2100.00');
    expect(p.net.toFixed(2)).toBe('38200.10');
  });
  test('mid-month join uses calendar-day proration', () =>
    expect(calculatePayroll(rules, 30, 15, '0').gross.toFixed(2)).toBe('21000.00'));
  test('decimal cents remain exact', () => {
    const p = calculatePayroll([{ ...rules[0], value: '0.10' }], 30, 30, '0', [
      { code: 'BONUS', kind: 'EARNING', amount: '0.20', note: 'Synthetic precision test' },
    ]);
    expect(p.net.toFixed(2)).toBe('0.30');
  });
  test('deductions cannot exceed gross', () =>
    expect(() =>
      calculatePayroll(rules, 30, 30, '0', [
        { code: 'EXCESS', kind: 'DEDUCTION', amount: '50000', note: 'Invalid test' },
      ]),
    ).toThrow());
  test('rejects invalid day counts and circular rules', () => {
    expect(() => calculatePayroll(rules, 30, 15, '16')).toThrow();
    expect(() =>
      calculatePayroll([{ ...rules[0] }, { ...rules[1], method: 'PERCENT_GROSS' }], 30, 30, '0'),
    ).toThrow();
  });
  test('eligibility ceiling disables configured deduction', () => {
    const p = calculatePayroll(
      [
        ...rules,
        {
          code: 'ELIGIBILITY',
          name: 'Ceiling',
          kind: 'DEDUCTION',
          method: 'PERCENT_GROSS',
          value: '2',
          prorate: false,
          eligibilityGrossMax: '10000',
        },
      ],
      30,
      30,
      '0',
    );
    expect(p.lines.find((l) => l.code === 'ELIGIBILITY')!.amount.toFixed(2)).toBe('0.00');
  });
});
describe('Security utilities', () => {
  test('authenticated encryption detects tampering', () => {
    const key = 'ab'.repeat(32),
      value = encrypt('sensitive bank record', key);
    expect(decrypt(value, key)).toBe('sensitive bank record');
    expect(() => decrypt(value.slice(0, -4) + 'AAAA', key)).toThrow();
    expect(value).not.toContain('sensitive');
  });
  test('token hashes and constant-time equality', () => {
    expect(hash('secret')).not.toBe('secret');
    expect(safeEqual(hash('a'), hash('a'))).toBe(true);
    expect(safeEqual('a', 'ab')).toBe(false);
  });
  test('CSV formula injection is neutralized', () => {
    expect(toCsv([{ name: '=HYPERLINK("evil")', count: 1 }])).toContain("'=HYPERLINK");
  });
  test('file signature detection rejects spoofed executable', () => {
    expect(documentMime(Buffer.from('MZevil'))).toBeNull();
    expect(documentMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
  });
});
