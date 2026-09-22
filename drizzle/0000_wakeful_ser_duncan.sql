CREATE TABLE `admin_bootstrap` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `compliments` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`message` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL,
	`is_hidden` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_compliments_receiver_created` ON `compliments` (`receiver_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_compliments_sender_created` ON `compliments` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_compliments_hidden_created` ON `compliments` (`is_hidden`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`compliment_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`compliment_id`) REFERENCES `compliments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reports_compliment_reporter` ON `reports` (`compliment_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_nickname` text NOT NULL,
	`nickname_key` text NOT NULL,
	`lol_nickname` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`avatar` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_read_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_nickname_key` ON `users` (`nickname_key`);