CREATE TABLE "tunnels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"target" text DEFAULT 'localhost' NOT NULL,
	"port" integer NOT NULL,
	"cloudflare_tunnel_id" text,
	"status" text DEFAULT 'stopped' NOT NULL,
	"pid" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tunnels_name_unique" UNIQUE("name")
);
