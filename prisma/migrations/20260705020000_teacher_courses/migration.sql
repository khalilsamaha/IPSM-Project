CREATE TABLE "teacher_courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "level_id" UUID,
    "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    CONSTRAINT "teacher_courses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teacher_courses_teacher_id_course_id_level_id_key" ON "teacher_courses"("teacher_id", "course_id", "level_id");
CREATE INDEX "teacher_courses_teacher_id_idx" ON "teacher_courses"("teacher_id");
CREATE INDEX "teacher_courses_course_id_idx" ON "teacher_courses"("course_id");
CREATE INDEX "teacher_courses_level_id_idx" ON "teacher_courses"("level_id");
CREATE INDEX "teacher_courses_status_idx" ON "teacher_courses"("status");
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "course_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
