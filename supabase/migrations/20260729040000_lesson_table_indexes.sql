-- Additive indexes for the server-side lessons register.
CREATE INDEX "schedule_sessions_session_date_start_time_idx" ON "schedule_sessions"("session_date", "start_time");
CREATE INDEX "schedule_sessions_season_id_session_date_idx" ON "schedule_sessions"("season_id", "session_date");
CREATE INDEX "schedule_sessions_status_session_date_idx" ON "schedule_sessions"("status", "session_date");
