-- No backfill: only compliments registered after this migration need email.
CREATE TABLE compliment_notifications (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  compliment_id TEXT NOT NULL REFERENCES compliments(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_compliment_notifications_compliment
  ON compliment_notifications (compliment_id);
--> statement-breakpoint
CREATE TRIGGER queue_compliment_notification AFTER INSERT ON compliments
BEGIN
  INSERT INTO compliment_notifications (compliment_id) VALUES (NEW.id);
END;
