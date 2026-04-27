import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const outlets = pgTable(
  'outlets',
  {
    ...tenantOwnedColumns,
    name: text('name').notNull(),
    code: text('code').notNull(),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    city: text('city').notNull(),
    province: text('province').notNull(),
    postalCode: text('postal_code'),
    phone: text('phone'),
    ppnBpsOverride: integer('ppn_bps_override'),
    serviceChargeBps: integer('service_charge_bps').notNull().default(0),
    businessDayBoundary: text('business_day_boundary'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    tenantIdx: index('outlets_tenant_idx').on(t.tenantId),
    codeUq: uniqueIndex('outlets_tenant_code_uq')
      .on(t.tenantId, t.code)
      .where(sql`deleted_at is null`),
  }),
);

export type Outlet = typeof outlets.$inferSelect;
