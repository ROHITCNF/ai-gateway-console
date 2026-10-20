CREATE TABLE "requests" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"feature_id" text NOT NULL,
	"team" text NOT NULL,
	"planned_model_id" text NOT NULL,
	"served_model_id" text,
	"status" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost" double precision NOT NULL,
	"error_reason" text
);
--> statement-breakpoint
CREATE TABLE "route_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" text NOT NULL,
	"feature_id" text NOT NULL,
	"old_main_model_id" text NOT NULL,
	"new_main_model_id" text NOT NULL,
	"old_fallback_model_id" text NOT NULL,
	"new_fallback_model_id" text NOT NULL,
	"source" text NOT NULL,
	"estimated_cost_change_percent" double precision
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"feature_id" text PRIMARY KEY NOT NULL,
	"main_model_id" text NOT NULL,
	"fallback_model_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "requests_timestamp_idx" ON "requests" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "requests_feature_idx" ON "requests" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "requests_model_idx" ON "requests" USING btree ("served_model_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "route_changes_timestamp_idx" ON "route_changes" USING btree ("timestamp");