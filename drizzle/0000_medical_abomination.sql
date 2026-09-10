CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_decks_owner` ON `decks` (`owner`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`owner` text NOT NULL,
	`guest` text,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_code_unique` ON `games` (`code`);--> statement-breakpoint
CREATE INDEX `idx_games_owner` ON `games` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_games_guest` ON `games` (`guest`);--> statement-breakpoint
CREATE TABLE `pools` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pools_owner` ON `pools` (`owner`);