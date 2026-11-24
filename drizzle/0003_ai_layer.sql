CREATE TYPE "public"."ai_insight_kind" AS ENUM('forecast', 'customer_drop', 'stockout_risk', 'order_anomaly');--> statement-breakpoint
CREATE TYPE "public"."ai_trace_status" AS ENUM('ok', 'invalid', 'refused', 'error', 'example');--> statement-breakpoint
CREATE TABLE "ai_eval_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"case_id" text NOT NULL,
	"question" text NOT NULL,
	"expected" jsonb NOT NULL,
	"got" jsonb,
	"pass" boolean NOT NULL,
	"reason" text,
	"latency_ms" integer,
	"cost_usd" numeric(10, 6)
);
--> statement-breakpoint
CREATE TABLE "ai_eval_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"model" text NOT NULL,
	"effort" text NOT NULL,
	"prompt_version" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"cases" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"p50_ms" integer,
	"p95_ms" integer,
	"cost_usd" numeric(10, 6),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "ai_insight_kind" NOT NULL,
	"severity" smallint DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"entity" text,
	"entity_id" integer,
	"value" numeric(16, 2),
	"data" jsonb,
	"method" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_traces" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"persona" text,
	"question" text NOT NULL,
	"status" "ai_trace_status" NOT NULL,
	"plan" jsonb,
	"error" text,
	"model" text,
	"served_by" text,
	"effort" text,
	"prompt_version" text,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cost_usd" numeric(10, 6),
	"rows" integer,
	"feedback" smallint
);
--> statement-breakpoint
ALTER TABLE "ai_eval_results" ADD CONSTRAINT "ai_eval_results_run_id_ai_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_eval_results_run_idx" ON "ai_eval_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_traces_at_idx" ON "ai_traces" USING btree ("at");--> statement-breakpoint
CREATE INDEX "ai_traces_status_idx" ON "ai_traces" USING btree ("status");