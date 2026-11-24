import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

const updatedAt = text("updated_at").notNull();

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  barcode: text("barcode"),
  category: text("category"),
  unit: text("unit").default("عدد"),
  cost: numeric("cost", { precision: 18, scale: 3 }).notNull().default("0"),
  price: numeric("price", { precision: 18, scale: 3 }).notNull().default("0"),
  stock: numeric("stock", { precision: 18, scale: 3 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 18, scale: 3 }).notNull().default("0"),
  vatable: boolean("vatable").notNull().default(true),
  updatedAt,
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("customer"),
  phone: text("phone"),
  note: text("note"),
  updatedAt,
});

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  no: text("no").notNull(),
  kind: text("kind").notNull().default("sale"),
  date: text("date").notNull(),
  contactId: text("contact_id"),
  contactName: text("contact_name"),
  items: jsonb("items").notNull().default([]),
  discount: numeric("discount", { precision: 18, scale: 3 }).notNull().default("0"),
  vat: numeric("vat", { precision: 18, scale: 3 }).notNull().default("0"),
  total: numeric("total", { precision: 18, scale: 3 }).notNull().default("0"),
  paid: numeric("paid", { precision: 18, scale: 3 }).notNull().default("0"),
  method: text("method").default("cash"),
  note: text("note"),
  updatedAt,
});

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  category: text("category"),
  amount: numeric("amount", { precision: 18, scale: 3 }).notNull().default("0"),
  account: text("account"),
  updatedAt,
});

export const receipts = pgTable("receipts", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  contactId: text("contact_id"),
  dir: text("dir").notNull().default("in"),
  amount: numeric("amount", { precision: 18, scale: 3 }).notNull().default("0"),
  method: text("method").default("cash"),
  note: text("note"),
  updatedAt,
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  contactId: text("contact_id"),
  amount: numeric("amount", { precision: 18, scale: 3 }).notNull().default("0"),
  refId: text("ref_id"),
  updatedAt,
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt,
});

export const deletedRecords = pgTable(
  "deleted_records",
  {
    entity: text("entity").notNull(),
    recordId: text("record_id").notNull(),
    deletedAt: text("deleted_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.entity, t.recordId] })],
);
