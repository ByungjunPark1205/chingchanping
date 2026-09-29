CREATE TABLE `member_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text,
	`source_nickname` text NOT NULL,
	`target_nickname` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `approval_status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `merged_into` text REFERENCES users(id);
--> statement-breakpoint
-- These guards execute inside the same D1 batch as the membership changes.
CREATE TRIGGER member_action_guard BEFORE INSERT ON member_actions
BEGIN
  SELECT RAISE(ABORT, 'member_action_invalid_actor') WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.actor_id AND role='admin' AND is_active=1 AND approval_status='approved' AND merged_into IS NULL
  );
  SELECT RAISE(ABORT, 'member_action_invalid_source') WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.source_id AND role='member' AND merged_into IS NULL AND chat_nickname=NEW.source_nickname
  );
  SELECT RAISE(ABORT, 'member_action_invalid_kind') WHERE NEW.action NOT IN ('approve','remove','restore','merge');
  SELECT RAISE(ABORT, 'member_action_invalid_approval') WHERE NEW.action='approve' AND NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.source_id AND is_active=1 AND approval_status='pending'
  );
  SELECT RAISE(ABORT, 'member_action_invalid_removal') WHERE NEW.action='remove' AND NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.source_id AND is_active=1
  );
  SELECT RAISE(ABORT, 'member_action_invalid_restore') WHERE NEW.action='restore' AND NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.source_id AND is_active=0
  );
  SELECT RAISE(ABORT, 'member_action_invalid_target') WHERE NEW.action='merge' AND (NEW.source_id=NEW.target_id OR NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.target_id AND role='member' AND is_active=1 AND approval_status='approved' AND merged_into IS NULL AND chat_nickname=NEW.target_nickname
  ));
END;
