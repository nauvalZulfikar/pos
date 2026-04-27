/**
 * Seed runner — populates feature catalog + a demo tenant for local dev.
 *
 * Demo credentials (printed at the end):
 *   - Owner: admin@desain.id / admin123
 *   - Kasir PIN: 1234
 *   - Demo URL: http://localhost:5173/login-pin?outlet=<UUID>
 */

import argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { fromRupiah } from '@desain/domain';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index.js';
import { FEATURE_SEED } from './features.js';

// Stable demo UUIDs so URLs are predictable across reseeds.
const DEMO_TENANT_ID = '00000000-0000-7000-8000-000000000001';
const DEMO_OUTLET_ID = '00000000-0000-7000-8000-000000000002';
const DEMO_OWNER_USER_ID = '00000000-0000-7000-8000-000000000003';
const DEMO_KASIR_USER_ID = '00000000-0000-7000-8000-000000000004';

const CAT_MAKANAN = '00000000-0000-7000-8000-000000000010';
const CAT_MINUMAN = '00000000-0000-7000-8000-000000000011';
const CAT_DESSERT = '00000000-0000-7000-8000-000000000012';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be set');

const sqlClient = postgres(url, { max: 1, prepare: false });
const db = drizzle(sqlClient, { schema });

async function seedFeatures(): Promise<void> {
  for (const f of FEATURE_SEED) {
    await db
      .insert(schema.features)
      .values({
        code: f.code,
        group: f.group,
        displayName: f.displayName,
        description: f.description,
        monthlyPrice: f.monthlyPrice,
        dependsOn: f.dependsOn,
        isActive: f.isActive,
      })
      .onConflictDoUpdate({
        target: schema.features.code,
        set: {
          group: f.group,
          displayName: f.displayName,
          description: f.description,
          monthlyPrice: f.monthlyPrice,
          dependsOn: f.dependsOn,
          isActive: f.isActive,
          updatedAt: sql`now()`,
        },
      });
  }
  console.warn(`[seed] ${FEATURE_SEED.length} features upserted`);
}

async function seedDemoTenant(): Promise<void> {
  // Tenant
  await db
    .insert(schema.tenants)
    .values({
      id: DEMO_TENANT_ID,
      legalName: 'PT Warung Demo',
      displayName: 'Warung Demo',
      npwp: null,
      isPkp: true, // PKP so PPN 11% applies → real flow
      segment: 'cafe',
      defaultLocale: 'id-ID',
      defaultTimezone: 'Asia/Jakarta',
      businessDayBoundary: '04:00',
      status: 'active',
    })
    .onConflictDoNothing();

  // Outlet
  await db
    .insert(schema.outlets)
    .values({
      id: DEMO_OUTLET_ID,
      tenantId: DEMO_TENANT_ID,
      name: 'Cabang Pusat',
      code: 'PUSAT',
      addressLine1: 'Jl. Merdeka No. 1',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      postalCode: '10110',
      phone: '021-1234567',
      ppnBpsOverride: null,
      serviceChargeBps: 500, // 5% service charge
      businessDayBoundary: null,
      isActive: true,
    })
    .onConflictDoNothing();

  // Owner user with password
  const ownerPasswordHash = await argon2.hash('admin123');
  await db
    .insert(schema.users)
    .values({
      id: DEMO_OWNER_USER_ID,
      email: 'admin@desain.id',
      fullName: 'Demo Owner',
      phone: '+62811111111',
      passwordHash: ownerPasswordHash,
      pinHash: null,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { passwordHash: ownerPasswordHash, updatedAt: sql`now()` },
    });

  // Kasir user with PIN 1234
  const kasirPinHash = await argon2.hash(`1234:${DEMO_KASIR_USER_ID}`);
  await db
    .insert(schema.users)
    .values({
      id: DEMO_KASIR_USER_ID,
      email: 'kasir@desain.id',
      fullName: 'Demo Kasir',
      phone: null,
      passwordHash: null,
      pinHash: kasirPinHash,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { pinHash: kasirPinHash, updatedAt: sql`now()` },
    });

  // Memberships
  await db
    .insert(schema.memberships)
    .values([
      {
        id: '00000000-0000-7000-8000-000000000005',
        tenantId: DEMO_TENANT_ID,
        userId: DEMO_OWNER_USER_ID,
        role: 'owner',
        outletPermissions: [],
        isActive: true,
      },
      {
        id: '00000000-0000-7000-8000-000000000006',
        tenantId: DEMO_TENANT_ID,
        userId: DEMO_KASIR_USER_ID,
        role: 'kasir',
        outletPermissions: [],
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  // Enable a generous demo feature set so most paths can be exercised.
  const enabledFeatures = [
    'core_pos',
    'core_admin',
    'core_reports',
    'core_audit',
    'qris_native',
    'ewallet_aggregator',
    'split_payment',
    'kds_routing',
    'table_management',
    'shift_cash_drawer',
    'inventory_recipe',
    'stock_alerts',
    'whatsapp_receipts',
    'customer_directory',
  ] as const;
  for (const code of enabledFeatures) {
    await db
      .insert(schema.tenantFeatures)
      .values({
        tenantId: DEMO_TENANT_ID,
        featureCode: code,
        enabled: true,
        source: 'comp',
      })
      .onConflictDoNothing();
  }

  // Menu: 3 categories + 8 items
  await db
    .insert(schema.menuCategories)
    .values([
      {
        id: CAT_MAKANAN,
        tenantId: DEMO_TENANT_ID,
        name: 'Makanan',
        sortOrder: 1,
        iconKey: null,
        isActive: true,
      },
      {
        id: CAT_MINUMAN,
        tenantId: DEMO_TENANT_ID,
        name: 'Minuman',
        sortOrder: 2,
        iconKey: null,
        isActive: true,
      },
      {
        id: CAT_DESSERT,
        tenantId: DEMO_TENANT_ID,
        name: 'Dessert',
        sortOrder: 3,
        iconKey: null,
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  type MenuSeed = { id: string; categoryId: string; name: string; basePriceRupiah: number };
  const menus: MenuSeed[] = [
    { id: '00000000-0000-7000-8000-000000000020', categoryId: CAT_MAKANAN, name: 'Nasi Goreng Spesial', basePriceRupiah: 35_000 },
    { id: '00000000-0000-7000-8000-000000000021', categoryId: CAT_MAKANAN, name: 'Mie Goreng Jawa', basePriceRupiah: 30_000 },
    { id: '00000000-0000-7000-8000-000000000022', categoryId: CAT_MAKANAN, name: 'Ayam Geprek', basePriceRupiah: 28_000 },
    { id: '00000000-0000-7000-8000-000000000023', categoryId: CAT_MAKANAN, name: 'Soto Ayam', basePriceRupiah: 25_000 },
    { id: '00000000-0000-7000-8000-000000000024', categoryId: CAT_MINUMAN, name: 'Es Teh Manis', basePriceRupiah: 8_000 },
    { id: '00000000-0000-7000-8000-000000000025', categoryId: CAT_MINUMAN, name: 'Es Jeruk', basePriceRupiah: 12_000 },
    { id: '00000000-0000-7000-8000-000000000026', categoryId: CAT_MINUMAN, name: 'Kopi Susu Gula Aren', basePriceRupiah: 18_000 },
    { id: '00000000-0000-7000-8000-000000000027', categoryId: CAT_DESSERT, name: 'Es Krim Vanilla', basePriceRupiah: 15_000 },
  ];

  for (const m of menus) {
    await db
      .insert(schema.menuItems)
      .values({
        id: m.id,
        tenantId: DEMO_TENANT_ID,
        categoryId: m.categoryId,
        name: m.name,
        description: null,
        sku: null,
        basePrice: fromRupiah(m.basePriceRupiah),
        pricingByProfile: {},
        outletOverrides: [],
        imageUrl: null,
        modifierGroupIds: [],
        isActive: true,
        ppnBpsOverride: null,
      })
      .onConflictDoNothing();
  }

  // 8 tables (Meja 1..8)
  for (let i = 1; i <= 8; i++) {
    const id = `00000000-0000-7000-8000-0000000000${(30 + i).toString().padStart(2, '0')}`;
    await db
      .insert(schema.tables)
      .values({
        id,
        tenantId: DEMO_TENANT_ID,
        outletId: DEMO_OUTLET_ID,
        label: String(i),
        capacity: i % 2 === 0 ? 4 : 2,
        status: 'available',
      })
      .onConflictDoNothing();
  }

  console.warn(`[seed] demo tenant ready`);
  console.warn('');
  console.warn('  ╔════════════════════════════════════════════════════════════╗');
  console.warn('  ║                    DEMO CREDENTIALS                        ║');
  console.warn('  ╠════════════════════════════════════════════════════════════╣');
  console.warn('  ║  Admin (Next.js):     http://localhost:3001/login          ║');
  console.warn('  ║    Email:             admin@desain.id                      ║');
  console.warn('  ║    Password:          admin123                             ║');
  console.warn('  ║                                                            ║');
  console.warn('  ║  Kasir (PWA):         http://localhost:5173/login-pin      ║');
  console.warn('  ║                       ?outlet=' + DEMO_OUTLET_ID + ' ║');
  console.warn('  ║    PIN:               1234                                 ║');
  console.warn('  ║                                                            ║');
  console.warn('  ║  Marketing:           http://localhost:3002                ║');
  console.warn('  ║  API:                 http://localhost:3000/healthz        ║');
  console.warn('  ╚════════════════════════════════════════════════════════════╝');
}

async function run(): Promise<void> {
  await seedFeatures();
  await seedDemoTenant();
  await sqlClient.end();
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
