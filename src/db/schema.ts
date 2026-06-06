import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const tunnels = pgTable("tunnels", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  domain: text("domain").notNull(),
  target: text("target").notNull().default("localhost"),
  port: integer("port").notNull(),
  cloudflareTunnelId: text("cloudflare_tunnel_id"),
  status: text("status", {
    enum: ["stopped", "running", "error", "creating"],
  })
    .notNull()
    .default("stopped"),
  pid: integer("pid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
