// biome-ignore-all lint/correctness/noUnusedFunctionParameters: <ignore>
import type { Schema } from "../orm/migrations/schema-builder";

export const name = "0001_initial";

export async function up(db: any, schema: Schema) {
  // 1. Users table
  await schema.createTable("users", (table) => {
    table.text("id").primaryKey();
    table.text("email").notNull().unique();
    table.text("name").notNull();
    table.text("password");
    table.text("image");
    table.bytea("recovery_code").notNull();
    table.timestamp("email_verified_at");
    table.timestamp("created_at").notNull().defaultNow();
    table.timestamp("updated_at");
  });

  // 2. Roles table
  await schema.createTable("roles", (table) => {
    table.text("id").primaryKey();
    table.text("name").notNull().unique();
    table.text("description");
  });

  // 3. Permissions table
  await schema.createTable("permissions", (table) => {
    table.text("id").primaryKey();
    table.text("name").notNull().unique();
    table.text("description");
  });

  // 4. Users to Roles (Pivot)
  await schema.createTable("users_to_roles", (table) => {
    table
      .text("user_id")
      .notNull()
      .references("users", "id")
      .onDelete("CASCADE");
    table
      .text("role_id")
      .notNull()
      .references("roles", "id")
      .onDelete("CASCADE");
    table.primary(["user_id", "role_id"]);
  });

  // 5. Users to Permissions (Pivot)
  await schema.createTable("users_to_permissions", (table) => {
    table
      .text("user_id")
      .notNull()
      .references("users", "id")
      .onDelete("CASCADE");
    table
      .text("permission_id")
      .notNull()
      .references("permissions", "id")
      .onDelete("CASCADE");
    table.primary(["user_id", "permission_id"]);
  });

  // 6. Roles to Permissions (Pivot)
  await schema.createTable("roles_to_permissions", (table) => {
    table
      .text("role_id")
      .notNull()
      .references("roles", "id")
      .onDelete("CASCADE");
    table
      .text("permission_id")
      .notNull()
      .references("permissions", "id")
      .onDelete("CASCADE");
    table.primary(["role_id", "permission_id"]);
  });

  // 7. Sessions table
  await schema.createTable("sessions", (table) => {
    table.text("id").primaryKey();
    table
      .text("user_id")
      .notNull()
      .references("users", "id")
      .onDelete("CASCADE");
    table.json("metadata");
    table.timestamp("expires_at").notNull();
    table.timestamp("created_at").notNull().defaultNow();
    table.timestamp("updated_at");
  });

  // 8. Email Verification Requests
  await schema.createTable("verification_requests", (table) => {
    table.text("id").primaryKey();
    table.text("email").notNull();
    table.text("code").notNull();
    table
      .text("user_id")
      .notNull()
      .references("users", "id")
      .onDelete("CASCADE");
    table.timestamp("expires_at").notNull();
    table.timestamp("created_at").notNull().defaultNow();
    table.timestamp("updated_at");
  });

  // 9. Password Reset Sessions
  await schema.createTable("reset_sessions", (table) => {
    table.text("id").primaryKey();
    table.text("email").notNull();
    table.text("code").notNull();
    table.boolean("email_verified").default(false);
    table
      .text("user_id")
      .notNull()
      .references("users", "id")
      .onDelete("CASCADE");
    table.timestamp("expires_at").notNull();
    table.timestamp("created_at").notNull().defaultNow();
    table.timestamp("updated_at");
  });

  // 10. Settings table
  await schema.createTable("settings", (table) => {
    table.text("id").primaryKey();
    table.text("key").notNull().unique();
    table.json("value").notNull();
    table.timestamp("updated_at").defaultNow();
  });
}

export async function down(db: any, schema: Schema) {
  await schema.dropTable("settings");
  await schema.dropTable("reset_sessions");
  await schema.dropTable("verification_requests");
  await schema.dropTable("sessions");
  await schema.dropTable("roles_to_permissions");
  await schema.dropTable("users_to_permissions");
  await schema.dropTable("users_to_roles");
  await schema.dropTable("permissions");
  await schema.dropTable("roles");
  await schema.dropTable("users");
}
