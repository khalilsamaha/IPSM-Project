# Academic setup

Administrators manage reusable courses, levels and prices at `/admin/academic-pricing`. The spreadsheet matrix is scoped to either **Global defaults** or one season. Green cells are direct globals, amber cells inherit an active global, blue cells are season overrides, red cells are missing, and grey cells are archived. The present schema does not model unsupported pairs; the legend says so rather than confusing unsupported with missing.

Edits remain local until **Save changed prices**. The server validates active course/level references and non-negative cents, rejects duplicate stored rows, writes every edit in one transaction, and emits one bulk audit event. Any invalid edit rolls back the batch. Registration resolves only an active exact season pair, then its active exact global pair, then no price; archived and near-match rows are never selected.

Teacher assignment administration is at `/admin/teacher-assignments`. `levelId = null` is displayed as **All levels**. Active exact-level and All levels assignments make a teacher eligible in registration; archived assignments do not. Bulk creation restores an archived match and preserves an active match rather than creating duplicates.
