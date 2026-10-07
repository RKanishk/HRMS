ALTER TABLE "LeaveBalance" ADD CONSTRAINT "leave_balance_nonnegative" CHECK ("entitled" >= 0 AND "used" >= 0 AND "reserved" >= 0 AND "used" + "reserved" <= "entitled");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "leave_dates_valid" CHECK ("startDate" <= "endDate" AND "days" > 0);
ALTER TABLE "Shift" ADD CONSTRAINT "shift_valid" CHECK ("startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 0 AND 1439 AND "halfDayMinutes" > 0 AND "fullDayMinutes" >= "halfDayMinutes" AND "graceMinutes" >= 0);
ALTER TABLE "Attendance" ADD CONSTRAINT "attendance_valid" CHECK ("workingMinutes" >= 0 AND "lateMinutes" >= 0 AND "earlyMinutes" >= 0 AND "overtimeMinutes" >= 0 AND ("checkOut" IS NULL OR "checkOut" >= "checkIn"));
ALTER TABLE "RawPunch" ADD CONSTRAINT "punch_direction" CHECK ("direction" IN ('IN','OUT'));
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "payroll_month_valid" CHECK ("month" BETWEEN 1 AND 12 AND "startDate" <= "endDate");
ALTER TABLE "PayrollEmployee" ADD CONSTRAINT "payroll_money_valid" CHECK ("gross" >= 0 AND "deductions" >= 0 AND "net" = "gross" - "deductions" AND "net" >= 0 AND "lopDays" >= 0 AND "paidDays" >= 0);
ALTER TABLE "SalaryRule" ADD CONSTRAINT "salary_rule_valid" CHECK ("value" >= 0 AND ("wageCap" IS NULL OR "wageCap" >= 0));
ALTER TABLE "PayrollInput" ADD CONSTRAINT "input_positive" CHECK ("amount" >= 0);
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "one_pending_regularization" ON "AttendanceRegularization"("employeeId", "date") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "holiday_branch_date_unique" ON "Holiday"("date", COALESCE("branchId", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX "one_open_lifecycle" ON "LifecycleCase"("employeeId", "kind") WHERE "status" = 'OPEN';
CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Append-only history cannot be modified' USING ERRCODE='23514'; END; $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER punch_append_only BEFORE UPDATE OR DELETE ON "RawPunch" FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE FUNCTION protect_locked_run() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."status"='LOCKED' THEN RAISE EXCEPTION 'Locked payroll is immutable' USING ERRCODE='23514'; END IF; RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END; $$;
CREATE TRIGGER payroll_run_lock BEFORE UPDATE OR DELETE ON "PayrollRun" FOR EACH ROW EXECUTE FUNCTION protect_locked_run();
CREATE FUNCTION protect_payroll_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior uuid; next_id uuid; parent uuid;
BEGIN
 IF TG_TABLE_NAME IN ('PayrollEmployee','PayrollInput') THEN
  IF TG_OP != 'INSERT' THEN prior := OLD."runId"; END IF;
  IF TG_OP != 'DELETE' THEN next_id := NEW."runId"; END IF;
 ELSE
  IF TG_OP != 'INSERT' THEN SELECT "runId" INTO prior FROM "PayrollEmployee" WHERE id=OLD."payrollEmployeeId"; END IF;
  IF TG_OP != 'DELETE' THEN SELECT "runId" INTO next_id FROM "PayrollEmployee" WHERE id=NEW."payrollEmployeeId"; END IF;
 END IF;
 SELECT id INTO parent FROM "PayrollRun" WHERE id IN (prior,next_id) AND status='LOCKED' LIMIT 1;
 IF parent IS NOT NULL THEN RAISE EXCEPTION 'Locked payroll is immutable' USING ERRCODE='23514'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER payroll_employee_lock BEFORE INSERT OR UPDATE OR DELETE ON "PayrollEmployee" FOR EACH ROW EXECUTE FUNCTION protect_payroll_child();
CREATE TRIGGER payroll_component_lock BEFORE INSERT OR UPDATE OR DELETE ON "PayrollComponent" FOR EACH ROW EXECUTE FUNCTION protect_payroll_child();
CREATE TRIGGER payroll_input_lock BEFORE INSERT OR UPDATE OR DELETE ON "PayrollInput" FOR EACH ROW EXECUTE FUNCTION protect_payroll_child();
CREATE TRIGGER payslip_lock BEFORE UPDATE OR DELETE ON "Payslip" FOR EACH ROW EXECUTE FUNCTION protect_payroll_child();
