CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_activity_created` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`cover_url` text DEFAULT '' NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`current_page` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'want' NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_books_status_updated` ON `books` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_books_title_author` ON `books` (`title`,`author`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`kind` text DEFAULT 'note' NOT NULL,
	`content` text NOT NULL,
	`page` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notes_book_updated` ON `notes` (`book_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`start_page` integer NOT NULL,
	`end_page` integer NOT NULL,
	`read_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_book_date` ON `reading_sessions` (`book_id`,`read_at`);--> statement-breakpoint
PRAGMA optimize;
