/**
 * Seed feature catalog.
 * Run via `pnpm db:seed`.
 */

import { fromRupiah } from '@desain/domain';
import type { Feature } from '@desain/types';

export const FEATURE_SEED: ReadonlyArray<Feature> = [
  // --- core (always-on, included in every plan) ---
  feat('core_pos', 'core', 99_000, 'POS Kasir Inti', 'Core kasir terminal', []),
  feat('core_admin', 'core', 0, 'Admin Dashboard', 'Owner/manager dashboard', []),
  feat('core_reports', 'core', 0, 'Laporan Dasar', 'Basic reports', []),
  feat('core_audit', 'core', 0, 'Audit Trail', 'Append-only audit log', []),

  // --- payment ---
  feat('qris_native', 'payment', 49_000, 'QRIS Native', 'QRIS via Midtrans / aggregator', []),
  feat('ewallet_aggregator', 'payment', 39_000, 'E-Wallet Aggregator', 'GoPay/OVO/Dana/ShopeePay via QRIS', ['qris_native']),
  feat('card_edc_recon', 'payment', 29_000, 'Rekonsiliasi EDC', 'EDC reconciliation', []),
  feat('split_payment', 'payment', 19_000, 'Split Payment', 'Multiple payments per order', []),

  // --- multi-outlet ---
  feat('multi_outlet_dashboard', 'multi_outlet', 99_000, 'Dashboard Multi-Cabang', 'Cross-outlet view', []),
  feat('multi_outlet_inventory', 'multi_outlet', 59_000, 'Stok Multi-Cabang', 'Per-outlet stock + transfers', ['multi_outlet_dashboard', 'inventory_recipe']),
  feat('multi_outlet_menu_overrides', 'multi_outlet', 29_000, 'Menu Override per Cabang', 'Per-outlet menu price/availability', ['multi_outlet_dashboard']),

  // --- delivery ---
  feat('gofood_integration', 'delivery', 79_000, 'Integrasi GoFood', 'GoFood order ingestion + menu sync', []),
  feat('grabfood_integration', 'delivery', 79_000, 'Integrasi GrabFood', 'GrabFood order ingestion + menu sync', []),
  feat('shopeefood_integration', 'delivery', 79_000, 'Integrasi ShopeeFood', 'ShopeeFood order ingestion + menu sync', []),
  feat('menu_sync_one_click', 'delivery', 49_000, 'Sinkron Menu 1-Klik', 'Push menu to all enabled platforms', []),
  feat('margin_after_commission', 'delivery', 29_000, 'Margin After Commission', 'Net margin per platform per item', ['inventory_recipe']),

  // --- inventory ---
  feat('inventory_recipe', 'inventory', 79_000, 'Resep & Bahan Baku', 'Recipe → auto stock deduction', []),
  feat('stock_alerts', 'inventory', 29_000, 'Peringatan Stok', 'Low-stock notifications', []),
  feat('purchase_orders', 'inventory', 49_000, 'Purchase Orders', 'PO + supplier tracking', []),
  feat('supplier_management', 'inventory', 29_000, 'Manajemen Supplier', 'Supplier directory', []),

  // --- ai ---
  feat('ai_daily_brief', 'ai', 99_000, 'Daily Brief AI', 'AI-generated daily summary in Bahasa Indonesia', ['core_reports']),
  feat('ai_menu_scoring', 'ai', 79_000, 'Skor Menu Otomatis', 'BCG-matrix menu performance', ['core_reports']),
  feat('ai_anomaly_detection', 'ai', 59_000, 'Deteksi Anomali', 'Anomaly detection on KPIs', []),
  feat('ai_demand_forecasting', 'ai', 99_000, 'Forecasting Permintaan', 'Demand forecast (90d data required)', ['core_reports']),
  feat('ai_recommendations', 'ai', 49_000, 'Rekomendasi Aksi', 'Actionable recommendations', []),

  // --- crm ---
  feat('customer_directory', 'crm', 49_000, 'Direktori Pelanggan', 'Customer database', []),
  feat('loyalty_points', 'crm', 49_000, 'Poin Loyalitas', 'Points + tiers', ['customer_directory']),
  feat('whatsapp_receipts', 'crm', 39_000, 'Struk WhatsApp', 'Digital receipts via WhatsApp', []),
  feat('whatsapp_marketing', 'crm', 79_000, 'WhatsApp Marketing', 'Campaign sends + segments', ['customer_directory', 'whatsapp_receipts']),

  // --- compliance ---
  feat('efaktur_b2b', 'compliance', 99_000, 'e-Faktur B2B', 'DJP integration for B2B tax invoices', ['customer_directory']),
  feat('audit_trail_immutable', 'compliance', 29_000, 'Audit Trail Stricter', 'Stricter void/discount rules', []),

  // --- ops ---
  feat('kds_routing', 'ops', 49_000, 'Routing KDS', 'Multi-station kitchen display routing', []),
  feat('table_management', 'ops', 39_000, 'Manajemen Meja', 'Table grid + dine-in flow', []),
  feat('shift_cash_drawer', 'ops', 0, 'Shift & Cash Drawer', 'Open/close shift, cash count', []),
  feat('happy_hour_pricing', 'ops', 29_000, 'Happy Hour', 'Time-based pricing profiles', []),
];

function feat(
  code: Feature['code'],
  group: Feature['group'],
  rupiah: number,
  idName: string,
  enName: string,
  dependsOn: Feature['dependsOn'],
): Feature {
  return {
    code,
    group,
    displayName: { 'id-ID': idName, 'en-US': enName },
    description: { 'id-ID': enName, 'en-US': enName },
    monthlyPrice: fromRupiah(rupiah),
    dependsOn,
    isActive: true,
  };
}
