CREATE TABLE `proof_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`actor` text NOT NULL,
	`command_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`claim` text NOT NULL,
	`base_version` integer NOT NULL,
	`result_version` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_proof_command_match` ON `proof_commands` (`match_id`);--> statement-breakpoint
CREATE TABLE `proof_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`guest` text,
	`mode` text NOT NULL,
	`scenario` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_proof_owner` ON `proof_matches` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_proof_guest` ON `proof_matches` (`guest`);