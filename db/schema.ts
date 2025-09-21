import { relations, sql } from 'drizzle-orm'
import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  date,
  uniqueIndex,
  index,
  json,
} from 'drizzle-orm/pg-core'

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member', 'viewer'])
export const projectStatusEnum = pgEnum('project_status', ['proposal', 'active', 'on_hold', 'completed', 'cancelled'])
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'overdue', 'paid', 'void'])

export const practices = pgTable('practices', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  billingEmail: text('billing_email'),
  currency: text('currency').notNull().default('GBP'),
  timezone: text('timezone').notNull().default('Europe/London'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('practices_slug_key').on(table.slug),
}))

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  timezone: text('timezone'),
  defaultPracticeId: uuid('default_practice_id').references(() => practices.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  defaultPracticeIdx: index('profiles_default_practice_idx').on(table.defaultPracticeId),
}))

export const practiceMembers = pgTable('practice_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  practiceId: uuid('practice_id').notNull().references(() => practices.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: memberRoleEnum('role').notNull().default('member'),
  invitedBy: uuid('invited_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  memberUnique: uniqueIndex('practice_members_practice_id_user_id_key').on(table.practiceId, table.userId),
  practiceIdx: index('practice_members_practice_idx').on(table.practiceId),
  userIdx: index('practice_members_user_idx').on(table.userId),
}))


export const practiceInvites = pgTable('practice_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: memberRoleEnum('role').notNull().default('member'),
  invitedByUserId: uuid('invited_by_user_id').references(() => profiles.userId, {
    onDelete: 'set null',
  }),
  supabaseUserId: uuid('supabase_user_id'),
  token: text('token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  practiceIdx: index('practice_invites_practice_idx').on(table.practiceId),
  emailIdx: index('practice_invites_email_idx').on(table.email),
  tokenIdx: uniqueIndex('practice_invites_token_key').on(table.token),
}))

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  practiceId: uuid('practice_id').notNull().references(() => practices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  companyName: text('company_name'),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  practiceIdx: index('clients_practice_idx').on(table.practiceId),
  practiceNameIdx: index('clients_practice_name_idx').on(table.practiceId, table.name),
}))

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  practiceId: uuid('practice_id').notNull().references(() => practices.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  code: text('code'),
  status: projectStatusEnum('status').notNull().default('proposal'),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  practiceIdx: index('projects_practice_idx').on(table.practiceId),
  clientIdx: index('projects_client_idx').on(table.clientId),
  practiceCodeIdx: uniqueIndex('projects_practice_code_key').on(table.practiceId, table.code),
}))

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  practiceId: uuid('practice_id').notNull().references(() => practices.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
  number: text('number').notNull(),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  issueDate: date('issue_date').notNull().default(sql.raw('current_date')),
  dueDate: date('due_date'),
  currency: text('currency').notNull().default('GBP'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  issuedBy: uuid('issued_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  practiceIdx: index('invoices_practice_idx').on(table.practiceId),
  clientIdx: index('invoices_client_idx').on(table.clientId),
  projectIdx: index('invoices_project_idx').on(table.projectId),
  practiceNumberIdx: uniqueIndex('invoices_practice_number_key').on(table.practiceId, table.number),
}))

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  invoiceIdx: index('invoice_line_items_invoice_idx').on(table.invoiceId),
  invoiceOrderIdx: index('invoice_line_items_invoice_sort_idx').on(table.invoiceId, table.sortOrder),
}))

export const practicesRelations = relations(practices, ({ many }) => ({
  members: many(practiceMembers),
  invites: many(practiceInvites),
  clients: many(clients),
  projects: many(projects),
  invoices: many(invoices),
}))

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  defaultPractice: one(practices, {
    fields: [profiles.defaultPracticeId],
    references: [practices.id],
  }),
  memberships: many(practiceMembers),
}))

export const practiceMembersRelations = relations(practiceMembers, ({ one }) => ({
  practice: one(practices, {
    fields: [practiceMembers.practiceId],
    references: [practices.id],
  }),
  profile: one(profiles, {
    fields: [practiceMembers.userId],
    references: [profiles.userId],
  }),
}))

export const practiceInvitesRelations = relations(practiceInvites, ({ one }) => ({
  practice: one(practices, {
    fields: [practiceInvites.practiceId],
    references: [practices.id],
  }),
  inviter: one(profiles, {
    fields: [practiceInvites.invitedByUserId],
    references: [profiles.userId],
  }),
}))

export const clientsRelations = relations(clients, ({ one, many }) => ({
  practice: one(practices, {
    fields: [clients.practiceId],
    references: [practices.id],
  }),
  projects: many(projects),
  invoices: many(invoices),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  practice: one(practices, {
    fields: [projects.practiceId],
    references: [practices.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  invoices: many(invoices),
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  practice: one(practices, {
    fields: [invoices.practiceId],
    references: [practices.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  lineItems: many(invoiceLineItems),
}))

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}))

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: text('action').notNull(),
  actorUserId: uuid('actor_user_id'),
  targetUserId: uuid('target_user_id'),
  metadata: json('metadata').$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
})

export type Practice = typeof practices.$inferSelect
export type NewPractice = typeof practices.$inferInsert
export type Profile = typeof profiles.$inferSelect
export type PracticeMember = typeof practiceMembers.$inferSelect
export type PracticeInvite = typeof practiceInvites.$inferSelect
export type Client = typeof clients.$inferSelect
export type Project = typeof projects.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert
