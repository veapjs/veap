import type { Schema } from "../orm/migrations/schema-builder";

export const name = "0005_user_widgets";

export async function up(_db: any, schema: Schema) {
  await schema.createTable("system_user_widgets", (table) => {
    table
      .text("user_id")
      .references("users", "id")
      .onDelete("CASCADE")
      .notNull();
    table.text("slot").notNull();
    table.jsonb("state").notNull().default("[]");

    table.primary(["user_id", "slot"]);
  });
}

export async function down(_db: any, schema: Schema) {
  await schema.dropTableIfExists("system_user_widgets");
}
