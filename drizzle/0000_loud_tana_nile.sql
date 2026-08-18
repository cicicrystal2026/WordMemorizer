CREATE TABLE `import_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`wordbook_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_type` text NOT NULL,
	`file_keys` text DEFAULT '[]' NOT NULL,
	`total_units` integer DEFAULT 0 NOT NULL,
	`processed_units` integer DEFAULT 0 NOT NULL,
	`report` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `import_jobs_user_idx` ON `import_jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`wordbook_id` integer NOT NULL,
	`target_date` text NOT NULL,
	`daily_new` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plans_user_status_idx` ON `plans` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `pron_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`word_id` integer NOT NULL,
	`overall` real NOT NULL,
	`accuracy` real,
	`fluency` real,
	`phonemes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pron_scores_user_word_idx` ON `pron_scores` (`user_id`,`word_id`);--> statement-breakpoint
CREATE TABLE `study_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`word_id` integer NOT NULL,
	`stage` text NOT NULL,
	`correct` integer NOT NULL,
	`answered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `study_logs_user_time_idx` ON `study_logs` (`user_id`,`answered_at`);--> statement-breakpoint
CREATE TABLE `study_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`word_id` integer NOT NULL,
	`mastery` text DEFAULT 'new' NOT NULL,
	`ease` real DEFAULT 2.5 NOT NULL,
	`interval` integer DEFAULT 0 NOT NULL,
	`due_at` text,
	`review_count` integer DEFAULT 0 NOT NULL,
	`last_studied_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_states_user_word_uniq` ON `study_states` (`user_id`,`word_id`);--> statement-breakpoint
CREATE INDEX `study_states_due_idx` ON `study_states` (`user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `word_details` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word_id` integer NOT NULL,
	`phonetic` text,
	`phrase` text,
	`sentence` text,
	`translation` text,
	`root_hint` text,
	`edited_by_user` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `word_details_word_uniq` ON `word_details` (`word_id`);--> statement-breakpoint
CREATE TABLE `wordbooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source_type` text NOT NULL,
	`total_words` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wordbooks_user_idx` ON `wordbooks` (`user_id`);--> statement-breakpoint
CREATE TABLE `words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wordbook_id` integer NOT NULL,
	`seq` integer,
	`word` text NOT NULL,
	`pos` text DEFAULT '[]' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`is_key` integer DEFAULT false NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	`confidence` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `words_book_idx` ON `words` (`wordbook_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `words_book_seq_uniq` ON `words` (`wordbook_id`,`seq`);