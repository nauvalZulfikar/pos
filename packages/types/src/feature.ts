import { z } from 'zod';
import { TenantId } from './common.js';

/**
 * Feature codes — single source of truth.
 * Add a new code here AND in the `features` seed when introducing a module.
 * AGENTS.md §6.
 */
export const FeatureCode = z.enum([
  // --- core (always-on; included in every plan) ---
  'core_pos',
  'core_admin',
  'core_reports',
  'core_audit',

  // --- payment ---
  'qris_native',
  'ewallet_aggregator',
  'card_edc_recon',
  'split_payment',

  // --- multi-outlet ---
  'multi_outlet_dashboard',
  'multi_outlet_inventory',
  'multi_outlet_menu_overrides',

  // --- delivery aggregator ---
  'gofood_integration',
  'grabfood_integration',
  'shopeefood_integration',
  'menu_sync_one_click',
  'margin_after_commission',

  // --- inventory ---
  'inventory_recipe',
  'stock_alerts',
  'purchase_orders',
  'supplier_management',

  // --- ai / insights ---
  'ai_daily_brief',
  'ai_menu_scoring',
  'ai_anomaly_detection',
  'ai_demand_forecasting',
  'ai_recommendations',

  // --- crm ---
  'customer_directory',
  'loyalty_points',
  'whatsapp_receipts',
  'whatsapp_marketing',

  // --- compliance ---
  'efaktur_b2b',
  'audit_trail_immutable',

  // --- ops ---
  'kds_routing',
  'table_management',
  'shift_cash_drawer',
  'happy_hour_pricing',
]);
export type FeatureCode = z.infer<typeof FeatureCode>;

export const FeatureGroup = z.enum([
  'core',
  'payment',
  'multi_outlet',
  'delivery',
  'inventory',
  'ai',
  'crm',
  'compliance',
  'ops',
]);
export type FeatureGroup = z.infer<typeof FeatureGroup>;

export const Feature = z.object({
  code: FeatureCode,
  group: FeatureGroup,
  displayName: z.object({
    'id-ID': z.string(),
    'en-US': z.string(),
  }),
  description: z.object({
    'id-ID': z.string(),
    'en-US': z.string(),
  }),
  monthlyPrice: z.bigint().nonnegative(),
  dependsOn: z.array(FeatureCode),
  isActive: z.boolean(),
});
export type Feature = z.infer<typeof Feature>;

export const TenantFeatureSource = z.enum(['subscription', 'trial', 'comp']);
export type TenantFeatureSource = z.infer<typeof TenantFeatureSource>;

export const TenantFeature = z.object({
  tenantId: TenantId,
  featureCode: FeatureCode,
  enabled: z.boolean(),
  enabledAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  source: TenantFeatureSource,
});
export type TenantFeature = z.infer<typeof TenantFeature>;

/** Hard dependencies enforced at billing time AND at the entitlement guard. */
export const HARD_DEPENDENCIES: Partial<Record<FeatureCode, readonly FeatureCode[]>> = {
  ewallet_aggregator: ['qris_native'],
  multi_outlet_inventory: ['multi_outlet_dashboard', 'inventory_recipe'],
  multi_outlet_menu_overrides: ['multi_outlet_dashboard'],
  menu_sync_one_click: ['gofood_integration'], // requires at least one delivery feature; checked dynamically too
  margin_after_commission: ['inventory_recipe'],
  ai_daily_brief: ['core_reports'],
  ai_menu_scoring: ['core_reports'],
  ai_demand_forecasting: ['core_reports'],
  loyalty_points: ['customer_directory'],
  whatsapp_marketing: ['customer_directory', 'whatsapp_receipts'],
  efaktur_b2b: ['customer_directory'],
} as const;

/** Segment thresholds for bundling discount. AGENTS.md §6.4. Stored in DB; this is the seed. */
export const PRICING_TIERS = [
  { code: 'warung', minSubtotal: BigInt(0), discountBps: 0 },
  { code: 'cafe', minSubtotal: BigInt(150_000_00), discountBps: 1000 }, // Rp150K → 10%
  { code: 'multi_cabang', minSubtotal: BigInt(400_000_00), discountBps: 2000 }, // Rp400K → 20%
  { code: 'chain', minSubtotal: BigInt(900_000_00), discountBps: 3000 }, // Rp900K → 30%
] as const;
