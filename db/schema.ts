import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    coverUrl: text("cover_url").notNull().default(""),
    pages: integer("pages").notNull().default(0),
    currentPage: integer("current_page").notNull().default(0),
    status: text("status", { enum: ["reading", "read", "paused", "abandoned", "want"] })
      .notNull()
      .default("want"),
    rating: integer("rating").notNull().default(0),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    description: text("description").notNull().default(""),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_books_status_updated").on(table.status, table.updatedAt),
    index("idx_books_title_author").on(table.title, table.author),
  ],
);

export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    startPage: integer("start_page").notNull(),
    endPage: integer("end_page").notNull(),
    readAt: text("read_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_sessions_book_date").on(table.bookId, table.readAt)],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["note", "quote", "highlight", "reflection"] })
      .notNull()
      .default("note"),
    content: text("content").notNull(),
    page: integer("page"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_notes_book_updated").on(table.bookId, table.updatedAt)],
);

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_activity_created").on(table.createdAt)],
);

export const userStats = sqliteTable("user_stats", {
  id: text("id").primaryKey(),
  currentStreak: integer("current_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  booksRead: integer("books_read").notNull().default(0),
  pagesRead: integer("pages_read").notNull().default(0),
  initializedAt: text("initialized_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const organizationItems = sqliteTable(
  "organization_items",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["categories", "tags", "collections"] }).notNull(),
    name: text("name").notNull(),
    bookIdsJson: text("book_ids_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_organization_kind_updated").on(table.kind, table.updatedAt),
    uniqueIndex("idx_organization_kind_name").on(table.kind, table.name),
  ],
);
