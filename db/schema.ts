import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    chatNickname: text("chat_nickname").notNull(),
    nicknameKey: text("nickname_key").notNull(),
    lolNickname: text("lol_nickname").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("member"),
    avatar: integer("avatar").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    isActive: integer("is_active").notNull().default(1),
    lastReadAt: integer("last_read_at").notNull().default(0),
  },
  (t) => [uniqueIndex("idx_users_nickname_key").on(t.nicknameKey)],
);
export const compliments = sqliteTable(
  "compliments",
  {
    id: text("id").primaryKey(),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => users.id),
    message: text("message").notNull(),
    category: text("category").notNull(),
    createdAt: integer("created_at").notNull(),
    isHidden: integer("is_hidden").notNull().default(0),
  },
  (t) => [
    index("idx_compliments_receiver_created").on(t.receiverId, t.createdAt),
    index("idx_compliments_sender_created").on(t.senderId, t.createdAt),
    index("idx_compliments_hidden_created").on(t.isHidden, t.createdAt),
  ],
);
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    complimentId: text("compliment_id")
      .notNull()
      .references(() => compliments.id),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
    status: text("status").notNull().default("pending"),
  },
  (t) => [
    uniqueIndex("idx_reports_compliment_reporter").on(
      t.complimentId,
      t.reporterId,
    ),
    index("idx_reports_status_created").on(t.status, t.createdAt),
  ],
);
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [
    index("idx_sessions_user").on(t.userId),
    index("idx_sessions_expires").on(t.expiresAt),
  ],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const adminBootstrap = sqliteTable("admin_bootstrap", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});
