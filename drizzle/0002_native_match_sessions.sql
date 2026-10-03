CREATE TABLE `native_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`actor` text NOT NULL,
	`request_hash` text NOT NULL,
	`claim` text NOT NULL,
	`base_version` integer NOT NULL,
	`result_version` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_native_command_match` ON `native_commands` (`match_id`);--> statement-breakpoint
CREATE TABLE `native_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`guest` text,
	`owner_side` text NOT NULL,
	`mode` text NOT NULL,
	`rules_version` text NOT NULL,
	`deck_size` integer NOT NULL,
	`owner_deck` text NOT NULL,
	`invite_token` text,
	`creation_hash` text NOT NULL,
	`state` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_native_owner` ON `native_matches` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_native_guest` ON `native_matches` (`guest`);