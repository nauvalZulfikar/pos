/**
 * Daily Brief prompt — versioned. AGENTS.md §14.4.
 *
 * Bumping the version invalidates cache and is recorded with each generation.
 */

export const DAILY_BRIEF_PROMPT_VERSION = '2026-04-25.1';

export type DailyBriefFacts = {
  outletName: string;
  businessDay: string;
  /** Compared values: today vs 7-day avg vs 28-day avg. */
  totals: {
    grossSales: number;
    orderCount: number;
    avgOrderValue: number;
    voidCount: number;
    discountTotal: number;
  };
  comparisons: {
    grossSalesVs7d: number; // pct
    orderCountVs7d: number;
    avgOrderValueVs7d: number;
  };
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  worstItems: Array<{ name: string; quantity: number; revenue: number }>;
  anomalies: Array<{ metric: string; severity: string; observed: string; expected: string }>;
  ppnIfPkp: { collected: number } | null;
};

export const DAILY_BRIEF_SYSTEM_PROMPT = `Anda adalah asisten analis bisnis untuk pemilik restoran/UMKM di Indonesia.

Aturan keluaran:
- Bahasa: Indonesia, register profesional santai (seperti konsultan bisnis kawan dekat).
- HINDARI istilah teknis berlebihan. Pemilik mungkin tidak punya latar belakang keuangan.
- Format: keluarkan SATU objek JSON valid yang cocok dengan skema yang diberikan, tanpa teks lain.
- Setiap rekomendasi harus berupa AKSI yang bisa dilakukan besok pagi, bukan saran abstrak.
- Maksimal 1 rekomendasi prioritas. Lebih dari satu = noise.
- Gunakan format Rupiah dengan titik ribuan: "Rp 1.234.567".`;

export type DailyBriefOutput = {
  greeting: string; // 1 kalimat
  highlights: string[]; // 2-3 bullet, max 80 char
  recommendation: {
    title: string;
    detail: string;
    expectedImpact: string;
  };
};

export function buildDailyBriefUserPrompt(facts: DailyBriefFacts): string {
  return `Fakta hari ini untuk ${facts.outletName} (${facts.businessDay}):

PENJUALAN:
- Bruto: Rp ${facts.totals.grossSales.toLocaleString('id-ID')} (${pct(facts.comparisons.grossSalesVs7d)} vs avg 7 hari)
- Jumlah order: ${facts.totals.orderCount} (${pct(facts.comparisons.orderCountVs7d)})
- Avg/order: Rp ${facts.totals.avgOrderValue.toLocaleString('id-ID')} (${pct(facts.comparisons.avgOrderValueVs7d)})
- Void: ${facts.totals.voidCount}
- Total diskon: Rp ${facts.totals.discountTotal.toLocaleString('id-ID')}

MENU TERLARIS HARI INI:
${facts.topItems.map((i) => `- ${i.name}: ${i.quantity}× = Rp ${i.revenue.toLocaleString('id-ID')}`).join('\n')}

MENU TERPUKUL:
${facts.worstItems.map((i) => `- ${i.name}: ${i.quantity}× = Rp ${i.revenue.toLocaleString('id-ID')}`).join('\n')}

ANOMALI YANG TERDETEKSI:
${facts.anomalies.length === 0 ? '(tidak ada)' : facts.anomalies.map((a) => `- ${a.metric} (${a.severity}): observed ${a.observed}, expected ${a.expected}`).join('\n')}

${facts.ppnIfPkp ? `PPN terkumpul: Rp ${facts.ppnIfPkp.collected.toLocaleString('id-ID')}` : ''}

Tugas: hasilkan JSON sesuai skema { greeting, highlights, recommendation { title, detail, expectedImpact } }.`;
}

function pct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(0)}%`;
}
