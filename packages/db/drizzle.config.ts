import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be set');

export default defineConfig({
  // Use a glob so drizzle-kit reads each schema file directly,
  // bypassing the `index.ts` barrel which has `.js` imports it can't resolve.
  schema: [
    './src/schema/tenants.ts',
    './src/schema/outlets.ts',
    './src/schema/users.ts',
    './src/schema/menu.ts',
    './src/schema/orders.ts',
    './src/schema/payments.ts',
    './src/schema/shifts.ts',
    './src/schema/inventory.ts',
    './src/schema/features.ts',
    './src/schema/audit.ts',
    './src/schema/sync.ts',
    './src/schema/customers.ts',
    './src/schema/delivery.ts',
    './src/schema/insights.ts',
    './src/schema/waste.ts',
    './src/schema/suppliers.ts',
    './src/schema/vouchers.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
