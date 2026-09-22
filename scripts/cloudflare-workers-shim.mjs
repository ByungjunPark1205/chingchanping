import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

const projectRoot = process.cwd();
const dataRoot = process.env.RENDER_DISK_PATH
  ? path.resolve(process.env.RENDER_DISK_PATH)
  : path.join(projectRoot, ".render-data");
fs.mkdirSync(dataRoot, { recursive: true });

const database = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
database.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
database.exec("CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
const migrations = fs.readdirSync(path.join(projectRoot, "drizzle")).filter((name) => name.endsWith(".sql")).sort();
for (const name of migrations) {
  const source = fs.readFileSync(path.join(projectRoot, "drizzle", name), "utf8");
  const checksum = createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex");
  const applied = database.prepare("SELECT checksum FROM _app_migrations WHERE name=?").get(name);
  if (applied) {
    if (applied.checksum !== checksum) throw new Error(`Applied migration was changed: ${name}`);
    continue;
  }
  // Adopt the same baseline created by the initial local Node preview, if present.
  const sql = name.startsWith("0000_")
    ? source.replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ").replaceAll("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ").replaceAll("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
    : source;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(sql);
    database.prepare("INSERT INTO _app_migrations (name,checksum) VALUES (?,?)").run(name, checksum);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

class D1PreparedStatement {
  constructor(sql, bindings = []) {
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new D1PreparedStatement(this.sql, bindings);
  }

  first(column) {
    const row = database.prepare(this.sql).get(...this.bindings);
    return (column ? row?.[column] : row) ?? null;
  }

  all() {
    return { success: true, results: database.prepare(this.sql).all(...this.bindings) };
  }

  run() {
    const result = database.prepare(this.sql).run(...this.bindings);
    return { success: true, results: [], meta: { changes: Number(result.changes ?? 0) } };
  }
}

class D1Database {
  prepare(sql) {
    return new D1PreparedStatement(sql);
  }

  batch(statements) {
    database.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.run());
      database.exec("COMMIT");
      return results;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

export const env = {
  DB: new D1Database(),
  ADMIN_SETUP_TOKEN: process.env.ADMIN_SETUP_TOKEN,
};
