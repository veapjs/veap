// biome-ignore-all lint/correctness/noUnusedFunctionParameters: <ignore>
import type { Schema } from "../orm/migrations/schema-builder";

export const name = "0002_plugins";

export async function up(db: any, schema: Schema) {
  await schema.createTable("plugins", (table) => {
    table.text("id").primaryKey();
    table.boolean("enabled").notNull().default(false);
    table.boolean("installed").notNull().default(false);
    table.boolean("deleted").notNull().default(false);
    table.boolean("system").notNull().default(false);
    table.text("config");
    table.text("last_step");
    table.timestamp("updated_at").defaultNow();
  });
}

export async function down(db: any, schema: Schema) {
  await schema.dropTable("plugins");
}
