-- Enable Row-Level Security for multi-tenant isolation
ALTER TABLE "Semester" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableSlot" ENABLE ROW LEVEL SECURITY;

-- Policies for Semester
CREATE POLICY "Users can only access their own semesters" ON "Semester"
FOR ALL
USING ("userId" = current_setting('app.current_user_id')::text);

-- Policies for Subject
CREATE POLICY "Users can only access their own subjects" ON "Subject"
FOR ALL
USING ("userId" = current_setting('app.current_user_id')::text);

-- Policies for Attendance
CREATE POLICY "Users can only access their own attendance logs" ON "Attendance"
FOR ALL
USING ("userId" = current_setting('app.current_user_id')::text);

-- Policies for TimetableSlot (Joined through Subject or Semester)
-- This is more complex, typically we'd just scope in Prisma.
-- For now, if TimetableSlot doesn't have userId, it needs one, or we join via Semester.
