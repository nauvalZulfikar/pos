# DESAIN POS — Feature Walkthrough

**Live:** https://pos.aureonforge.com
**Login owner:** `admin@desain.id` / `admin123`
**Kasir PIN:** `1234`
**Outlet seeded:** `Cabang Utama` (Jakarta)

---

## 0. Apps & navigasi

| URL | Aplikasi | Untuk siapa |
|---|---|---|
| `https://pos.aureonforge.com/` | Admin dashboard (Next.js) | Owner / manager |
| `https://pos.aureonforge.com/api/*` | REST API (Hono) | Internal — dipanggil dari admin/POS |
| `https://pos.aureonforge.com/kasir/` | POS PWA (Vite + Workbox) | Kasir / FOH |

**Login flow:**
- Admin: `/` → form email + password → cookie `desain_sid` → redirect ke `/overview`.
- Kasir: `/kasir/login-pin` → 4 digit PIN → ke `/kasir/tables`.

---

## 1. POS Terminal (kasir) — `/kasir/`

### 1.1 PIN login
**Apa:** Login cepat 4-digit pakai PIN kasir, bukan password.
**Akses:** Buka `/kasir/login-pin` → masukkan PIN `1234`.
**Test:**
- PIN salah → tampil error "PIN tidak cocok".
- PIN benar → redirect `/kasir/tables`, badge nama kasir muncul di top nav.

### 1.2 Tables / meja
**Apa:** Lihat semua meja, status (kosong/terisi), pilih meja sebelum bikin order dine-in.
**Akses:** Top nav → "Meja".
**Test:**
- Klik meja → state `tableId` di store ke-set, navigate ke `/kasir/order` (otomatis).
- Atau klik "Take Away" untuk skip meja.

### 1.3 Order entry — bikin order baru
**Apa:** Pilih kategori → pilih item → tambah ke cart → atur qty.
**Akses:** Top nav → "Order Baru".
**Test:**
- Filter kategori: klik chip kategori di atas → grid item ter-filter.
- Klik item → masuk cart sebelah kanan (qty 1, harga = base price × 1.11 PPN saat sub-total).
- Tombol `+` / `−` di setiap line ubah qty, totals update real-time.

### 1.4 Discount apply (NEW)
**Apa:** Tambah diskon order-level — persen atau nominal Rp, **alasan wajib min 3 char** (audit).
**Akses:** Di cart sebelah kanan → tombol `+ Diskon`.
**Test:**
- Pilih `Persen %` → input `10` → alasan `loyal customer` → Apply → diskon tampil baris baru `−Rp X`, total turun.
- Pilih `Nominal Rp` → input `5000` → diskon Rp 5.000 ke-apply.
- Diskon > subtotal otomatis di-cap ke subtotal (gak bisa minus).

### 1.5 Void item (NEW)
**Apa:** Hapus 1 line dari order, **alasan wajib min 3 char**.
**Akses:** Di cart line → tombol `Void`.
**Test:**
- Klik Void → modal alasan muncul → input `salah pesan` → konfirmasi → line hilang, subtotal recalculate.
- Audit log nge-record void saat order disubmit.

### 1.6 Send to Kitchen (NEW)
**Apa:** Submit order ke server tapi belum bayar — KDS chef langsung lihat.
**Akses:** Di cart → tombol `Kirim Dapur`.
**Test:**
- Klik → POST `/v1/orders` lalu `/v1/orders/:id/send-to-kitchen` → status `sent_to_kitchen` → cart auto-clear → balik ke `/tables`.
- Buka `/kasir/kds` di tab lain → order baru muncul di kanban "queued".

### 1.7 Payment screen (NEW) — Cash / QRIS / EDC
**Apa:** Layar pembayaran 3 metode, support kembalian + cetak struk.
**Akses:** Di cart → tombol `Bayar →` → redirect `/kasir/pay`.
**Test:**

**Cash:**
- Auto-fill total. Edit "diterima dari customer" → kembalian dihitung otomatis.
- Tombol disabled kalau diterima < total.
- Submit → status order = `paid`, masuk PaidScreen.

**QRIS:**
- Klik `Generate QR` → POST `/v1/payments/qris/intent`.
- Kalau env `MIDTRANS_SERVER_KEY` kosong → fallback mock (warning kuning muncul "Mock mode").
- Tombol `[DEV] Simulasi customer bayar` → POST `/v1/payments/qris/mock-settle` → status berubah ke `settled`, polling 2s detect → masuk PaidScreen.
- Real Midtrans: scan QR pakai HP, bayar via OVO/GoPay/dll → webhook update otomatis.

**EDC:**
- Charge manual di mesin EDC fisik. Input 4 digit terakhir kartu (opsional). Submit → POST `/v1/payments/card-edc` → status `settled` langsung.

### 1.8 Cetak struk (NEW)
**Apa:** Print receipt textual (ESC/POS-compatible).
**Akses:** PaidScreen → tombol `🖨️ Cetak Struk`.
**Test:**
- Klik → fetch `/v1/orders/:id/text` → buka popup baru dengan teks pre-formatted → user klik tombol Print di popup → browser print dialog.
- Untuk thermal printer, ada juga endpoint `/v1/orders/:id/escpos` (binary ESC/POS bytes).

### 1.9 Shift open / close + cash count (NEW)
**Apa:** Buka shift dengan modal awal, tutup shift dengan hitung kas, otomatis hitung **selisih kas**.
**Akses:** Top nav → "Buka Shift".
**Test:**
- Buka: input `100000` (Rp 1.000) modal awal → klik Buka → POST `/v1/shifts/open`.
- Tutup: input "kas dihitung" Rp 250.000 + catatan opsional → POST `/v1/shifts/:id/close`.
- Server hitung: `expected = startingCash + cashSalesDuringShift`, `variance = counted − expected`.
- Tampil ringkasan: modal awal, penjualan tunai, total order, **selisih merah/hijau**.

### 1.10 KDS (Kitchen Display)
**Apa:** Kanban untuk chef — item per kolom (queued / in_progress / served).
**Akses:** Top nav → "Order Aktif".
**Test:**
- Order yang di-send-to-kitchen muncul di "queued".
- Klik item → status pindah kolom: queued → preparing → served.
- Auto-refresh tiap 3 detik.

---

## 2. Admin Dashboard — `/`

### 2.1 Overview (KPI)
**Apa:** Ringkasan multi-outlet — total penjualan, order count, top items, breakdown per cabang.
**Akses:** Sidebar → "Ringkasan".
**Test:**
- Card 4 KPI di atas (sales hari ini, order count, AOV, pertumbuhan).
- Tabel breakdown per outlet — klik cabang untuk drill-down.

### 2.2 Menu management
**Apa:** CRUD items, kategori, modifier (size, level pedas, dll), upload gambar.
**Akses:** Sidebar → "Menu".
**Test:**
- `/menu` → daftar item. Klik `+ Item` → form (nama, harga, kategori, gambar).
- `/menu/categories` → CRUD kategori. Delete kategori yang masih ada item-nya **akan ditolak** (409 conflict).
- `/menu/modifiers` → CRUD modifier groups (e.g. "Level pedas: ringan, sedang, pedas").
- `/menu/[id]/recipe` → link bahan baku ke item, preview food cost.

### 2.3 Inventory (NEW: adjust)
**Apa:** Stok bahan baku dengan unit (gram/ml/pcs/dll) + cost per unit.
**Akses:** Sidebar → "Stok".
**Test:**
- `/inventory` → list bahan.
- `/inventory/new` → tambah bahan (nama, SKU, unit, cost).
- `/inventory/adjust` (NEW) → form: pilih cabang + bahan + delta (+/−) + alasan wajib → submit → POST `/v1/inventory/adjust`.
  - Test: tambah 5 kg beras, alasan "restock" → stock_levels naik 5000g, ada movement record.
  - Test negatif: −2.5 kg, alasan "rusak" → stock turun, audit jelas.

### 2.4 Customers + detail (NEW)
**Apa:** CRM ringan — daftar pelanggan + riwayat order + loyalty.
**Akses:** Sidebar → "Pelanggan".
**Test:**
- `/customers` → list, search by phone (via hash, tanpa decrypt).
- `/customers/[id]` (NEW) → 
  - Stat card: visit count, last visit, member sejak.
  - **Loyalty card hijau**: tier (regular/silver/gold), poin, lifetime spend.
  - Tags pelanggan.
  - Tabel **riwayat order**: 50 order terakhir, klik nomor → drill ke `/orders/[id]`.

### 2.5 Order admin + refund (NEW)
**Apa:** Lihat semua order, filter per outlet/status, refund payment.
**Akses:** Sidebar → "Order".
**Test:**
- `/orders` → filter outlet + status (open/sent/paid/voided/refunded).
- Klik nomor order → `/orders/[id]`:
  - Detail items dengan harga + status.
  - Total breakdown (subtotal, diskon, service, PPN, total).
  - **Daftar payment** dengan status.
  - Tombol `Refund` (NEW): muncul di payment yang sudah `settled`. Input amount + alasan → POST `/v1/payments/refund`.
    - Cash/EDC: instant succeeded.
    - QRIS: pending (akan diproses Midtrans).
  - Status payment → `refunded` (full) atau `partially_refunded`.

### 2.6 Outlets (cabang) CRUD
**Apa:** Multi-cabang — alamat, kode, service charge, PPN override, jam tutup.
**Akses:** Sidebar → "Cabang".
**Test:**
- `/outlets` → list. `+ Cabang Baru` → form lengkap.
- `/outlets/[id]` → edit. Soft delete = `deletedAt` set.

### 2.7 Staff management
**Apa:** Invite staff, set PIN kasir, deactivate, role assignment.
**Akses:** Sidebar → "Tim".
**Test:**
- `/staff/invite` → form (nama, email, role: owner/manager/cashier/cook/runner).
- `/staff/[id]` → tab detail + tombol "Reset PIN" → input 4-digit baru → Argon2 hash dengan salt `${pin}:${userId}`.
- Deactivate → `isActive=false`, login auto-tolak.

### 2.8 Vouchers (NEW: schedule + redemption)
**Apa:** Voucher diskon — code-based, % atau Rp, min purchase, schedule happy hour.
**Akses:** Sidebar → "Voucher".
**Test:**
- `/vouchers/new` → kode (uppercase), nama, type (percent/amount/happy_hour), value, min subtotal, max usages, valid from/to.
- **Schedule field (NEW)**: JSON `{"daysOfWeek":[1,2,3,4,5],"start":"17:00","end":"19:00"}` (Mon-Fri 5-7 PM Jakarta).
- API redeem (`/v1/vouchers/redeem`):
  - Test code expired → 400 "sudah kadaluarsa".
  - Test schedule miss (Sabtu / di luar jam) → 400 "tidak berlaku saat ini".
  - Test min purchase belum tercapai → 400.
  - Test sukses → return `discountSen`, increment `usedCount`, insert ke `voucher_redemptions`.
- *Catatan:* UI redeem di POS belum dibuat (still admin-side only).

### 2.9 Audit log
**Apa:** Append-only log — siapa, kapan, table, action, old/new diff.
**Akses:** Sidebar → "Audit Log".
**Test:**
- `/audit` → tabel. Setiap row klik untuk expand JSON diff `before` vs `after`.
- Trigger: edit menu → entry `update menu_items` muncul.
- Trigger: void item → entry dengan alasan tersimpan di `metadata`.
- **Append-only** dijaga di Postgres trigger (`fn_audit_log()`); INSERT-only, no DELETE/UPDATE.

### 2.10 Suppliers
**Apa:** Daftar supplier bahan + purchase order.
**Akses:** Sidebar → "Supplier".
**Test:** CRUD dasar (nama, contact, payment terms).

### 2.11 Reports
**Akses:** Sidebar → "Laporan".

**2.11.1 Daily report** (`/reports`)
- Hari ini: order count, gross sales, diskon total, PPN, service charge, AOV, void count.

**2.11.2 Sales trend** (chart 7 hari)
- Garis revenue per businessDay (Asia/Jakarta).

**2.11.3 Top items**
- Top 10 menu by revenue (period filter).

**2.11.4 Peak Hours analytics (NEW)** (`/reports/peak-hours`)
- 24 baris per jam, bar visualisasi distribusi pendapatan.
- **Top 3 jam sibuk** highlighted hijau.
- Test: pilih range tanggal → submit → series 24-jam terisi, baris peak nyala hijau.
- Use case: schedule staff tambahan, bikin happy hour voucher di luar jam ini.

### 2.12 AI (Daily Brief + Anomaly)
**Apa:** Worker harian generate ringkasan + deteksi anomali revenue ±20% dari baseline 7 hari.
**Akses:** Sidebar → "AI Brief".
**Test:**
- `/ai` → list daily briefs (LLM atau fallback deterministic).
- Card anomaly: severity high/medium dengan diff %.
- Klik anomaly → drill detail: hari mana, baseline avg, observed.

### 2.13 Settings (feature flags + tenant config)
**Akses:** Sidebar → "Pengaturan".
**Test:**
- Toggle modul on/off (38 codes, e.g. `loyalty_points`, `voucher`, `customer_directory`, `inventory_recipe`, dll).
- API endpoint yang require disabled feature → 403.

### 2.14 Signup (public)
**Apa:** Bikin tenant + outlet + owner sekaligus, auto-login.
**Akses:** `/signup` (publik tanpa auth).
**Test:**
- Form: nama bisnis, email owner, password, nama outlet, alamat → POST `/v1/signup` → atomic create tenant+outlet+owner+default features → set session cookie → redirect `/overview`.

---

## 3. Backend services

### 3.1 Recipe auto-deduct worker
**Apa:** Saat payment cash settle → enqueue job → worker decrement stok bahan baku per item recipe.
**Test:**
- Bayar order yang isinya item dengan recipe linked.
- Cek `stock_levels` → quantityMilli turun sesuai resep × qty.
- **Idempotent**: jalankan 2× orderId yang sama → cuma kurangi sekali (cek `recipe_consumption_log`).

### 3.2 Stock alerts worker
**Apa:** Cron harian, scan stock_levels per outlet, kalau di bawah `reorderThresholdMilli` → enqueue WhatsApp alert.
**Test:**
- Set threshold 1000g (1 kg) untuk beras.
- Adjust stok jadi 800g.
- Trigger worker manual: `pnpm --filter @desain/worker run scan:stock`.
- Cek `notifications.whatsapp` queue → job ter-enqueue.

### 3.3 Anomaly detection worker
**Apa:** Daily cron, hitung revenue hari ini vs avg 7 hari, kalau ±20% → tulis ke `anomalies` table.
**Test:**
- Seed 7 hari order revenue Rp 1jt/hari.
- Hari ini Rp 500rb (−50%).
- Trigger anomaly worker.
- `/admin/ai` → anomaly card "high severity, −50%".

### 3.4 Daily Brief worker
**Apa:** Aggregate metrics → call Anthropic Claude (kalau `ANTHROPIC_API_KEY` set) → narrative ID → save `daily_briefs`. Fallback deterministic kalau no key.
**Test:**
- Trigger `pnpm --filter @desain/worker run brief:daily`.
- `/ai` → narrative dalam Bahasa Indonesia ("Hari ini penjualan turun X% karena...").

### 3.5 Delivery inbound webhook
**Apa:** Receive webhook dari GoFood/Grab/Shopee → normalize → bikin internal Order dengan idempotency key.
**Test:**
- POST `/v1/webhooks/gofood` dengan signature dummy (di dev — production butuh real signing key).
- Cek `orders` table: source = `gofood`, status `accepted`.

### 3.6 PII encryption at rest (NEW)
**Apa:** Phone number disimpan AES-256-GCM encrypted di kolom `phone_encrypted`.
**Test:**
- Set env `PII_ENCRYPTION_KEY_HEX=$(openssl rand -hex 32)`.
- Bikin customer dengan phone `+6281234567890`.
- Query DB: `SELECT phone_encrypted FROM customers` → hasil `v1:<iv>:<tag>:<ciphertext>` (bukan plaintext).
- Tanpa key → fallback plaintext + warning log "PII_ENCRYPTION_KEY_HEX not set".

### 3.7 Loyalty earn + tier auto-upgrade (NEW)
**Apa:** Saat order paid + customerId set → POST `/v1/loyalty/earn` → +points (1 poin per Rp 1.000) + auto-upgrade tier berdasarkan `visitCount`.
**Test:**
- Tier rules:
  - regular: < 5 visits
  - silver: 5–19 visits
  - gold: 20+ visits
- Customer dengan 5 visit pertama → response `{tier: 'silver', upgraded: true}`.
- Tier **tidak pernah turun** (gold tetap gold meski visit drop).
- POST `/v1/loyalty/redeem` → 100 poin = Rp 1.000 diskon, kurang poin → 400.

---

## 4. Cross-cutting features

### 4.1 Multi-tenancy (RLS)
**Apa:** Setiap query auto-filtered ke tenantId via Postgres Row-Level Security policy.
**Test:**
- Login sebagai tenant A → query `SELECT * FROM orders` → cuma order tenant A muncul.
- Bypass possible cuma via service role (worker pakai DATABASE_ADMIN_URL).

### 4.2 Audit triggers (Postgres-level)
**Apa:** Trigger `fn_audit_log()` auto-fire di INSERT/UPDATE/DELETE pada 14 table sensitif (orders, payments, menu, dll).
**Test:**
- INSERT manual via psql → row baru auto muncul di `audit_log` table.
- Trigger handle composite PK (e.g. tenant_features) via try-catch + `to_jsonb(OLD) ->> 'id'`.

### 4.3 Idempotency (header `Idempotency-Key`)
**Apa:** POST mutations (orders, payments, refund) accept `Idempotency-Key` header → response cached 24 jam.
**Test:**
- Bayar order dengan `Idempotency-Key: abc123` → 201.
- Replay request yang sama → return cached response (no double-charge).

### 4.4 Sync engine (offline kasir)
**Apa:** Outbox table di POS → kasir offline tetap bisa bikin order → saat online → batch POST ke `/v1/sync/apply`.
**Test:**
- Disconnect WiFi di POS PWA → bikin order → status di local IndexedDB.
- Reconnect → sync trigger → server applier resolve conflict per entity → cleared.

### 4.5 Money handling (bigint sen)
**Apa:** Semua uang disimpan sebagai `bigint` dalam **sen** (Rp × 100). Banker's rounding via `bps()` helper.
**Test:**
- Rp 12.345 → DB: `1234500`.
- PPN 11% (1100 bps) → applied dengan banker's rounding (no float drift).

### 4.6 Feature flags (38 codes, à la carte)
**Apa:** Tenant aktifkan modul satu-satu — billing per modul.
**Test:**
- Disable `loyalty_points` → API `/v1/loyalty/*` return 403 "FEATURE_DISABLED".
- Hard dependencies enforced — e.g. `efaktur` requires `customer_directory`.

---

## 5. Cara test ujung-ke-ujung (smoke test 3 menit)

```
1. Buka https://pos.aureonforge.com → login admin@desain.id / admin123
2. /menu → klik 1 item → catat namanya
3. /kasir/login-pin → PIN 1234 → /tables → Take Away
4. Klik item yang tadi → cart isi → + Diskon 10% alasan "promo" → Apply
5. Bayar → → Tunai → terima 100k → Konfirmasi → PaidScreen ✓
6. Cetak Struk → popup print → close
7. Order Baru → balik dashboard admin → /orders → cari nomor order tadi
8. Klik → lihat detail (subtotal, diskon, PPN, payment)
9. Tombol Refund → 5000, alasan "test" → status payment jadi partially_refunded
10. /audit → entry void/discount/refund nampak semua dengan alasan + user
```

Kalau 10 step di atas hijau semua → sistem core jalan end-to-end.
