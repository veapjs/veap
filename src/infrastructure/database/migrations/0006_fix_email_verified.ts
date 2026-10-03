import type { Schema } from "../orm/migrations/schema-builder";

export const name = "0006_fix_email_verified";

export async function up(db: any, schema: Schema) {
  // Check if column exists to avoid errors on fresh installs
  // (since we also updated 0001_initial.ts to use email_verified)
  const hasOldColumn = await db.schema.hasColumn(
    "reset_sessions",
    "emailVerified",
  );
  if (hasOldColumn) {
    await db.schema.alterTable("reset_sessions", (table: any) => {
      table.renameColumn("emailVerified", "email_verified");
    });
  }
}

export async function down(db: any, schema: Schema) {
  const hasNewColumn = await db.schema.hasColumn(
    "reset_sessions",
    "email_verified",
  );
  if (hasNewColumn) {
    await db.schema.alterTable("reset_sessions", (table: any) => {
      table.renameColumn("email_verified", "emailVerified");
    });
  }
}
