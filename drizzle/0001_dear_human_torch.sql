CREATE TABLE `compliment_likes` (
	`compliment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`compliment_id`) REFERENCES `compliments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_likes_compliment_user` ON `compliment_likes` (`compliment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_likes_created` ON `compliment_likes` (`created_at`,`compliment_id`);