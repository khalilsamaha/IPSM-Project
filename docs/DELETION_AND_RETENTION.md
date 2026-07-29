# Deletion and retention

Archiving is the normal action for students, families, teachers, and lessons that have operational history. Permanent deletion is reserved for an archived record that was unused or created accidentally. Admin and Super Admin can permanently delete; Reception cannot.

**IPSM never deletes financial, receipt, attendance, lesson, or payroll history merely to allow deletion of a person or family record. Records with history must be archived.**

## Eligibility and confirmation

The permanent-deletion review obtains current database counts. Students are blocked by enrollments, recurring patterns, lessons, allocations, or payroll-linked lessons. Families are blocked by students (including archived students), payments, receipts, or enrollment relationships. Teachers are blocked by enrollments, patterns, lessons, payroll, or payroll-linked lessons. Teacher course assignments and availability rules are configuration only and may be removed when no history exists.

The server authorizes the actor, requires the exact displayed `DELETE <reference>` text (surrounding whitespace alone is ignored), and recalculates every count in a serializable transaction. It writes `entity_delete` or `entity_delete_blocked` audit metadata without names or other unnecessary personal information. Concurrent changes result in a safe review-and-try-again message.

## Lessons register

`/schedule` defaults to the URL-driven Lessons Table. Filters cover search, inclusive dates, season, teacher, student, family, course, level, room, status, recurring/manual source, attendance finalization, payroll, and record state. Sorting is allowlisted and server-side; pages contain 25, 50, or 100 rows. Metrics describe the complete filtered set. Student Lessons, Instrument View, Season Agenda, and Book Lesson remain separate tabs.
