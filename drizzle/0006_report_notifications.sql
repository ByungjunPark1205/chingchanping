CREATE TABLE report_notifications (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  report_id TEXT REFERENCES reports(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_report_notifications_report
  ON report_notifications (report_id);
--> statement-breakpoint
-- Include pending reports at installation, but never send resolved history.
INSERT INTO report_notifications (report_id)
  SELECT id FROM reports WHERE status='pending' ORDER BY created_at,id;
--> statement-breakpoint
CREATE TRIGGER queue_report_notification AFTER INSERT ON reports
BEGIN
  INSERT INTO report_notifications (report_id) VALUES (NEW.id);
END;
