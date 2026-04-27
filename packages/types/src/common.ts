import { z } from 'zod';

/**
 * UUIDv7 — sortable, generated client-side for offline creation.
 * Validated as a normal UUID at the type level; v7-specific bits are checked at runtime where it matters.
 */
export const UuidV7 = z.string().uuid().brand<'UuidV7'>();
export type UuidV7 = z.infer<typeof UuidV7>;

export const TenantId = UuidV7.brand<'TenantId'>();
export type TenantId = z.infer<typeof TenantId>;

export const OutletId = UuidV7.brand<'OutletId'>();
export type OutletId = z.infer<typeof OutletId>;

export const UserId = UuidV7.brand<'UserId'>();
export type UserId = z.infer<typeof UserId>;

export const DeviceId = UuidV7.brand<'DeviceId'>();
export type DeviceId = z.infer<typeof DeviceId>;

/** Money is integer minor units (sen). IDR has 2 decimals nominally; we store ×100 of IDR. */
export const Money = z.bigint().nonnegative().brand<'Money'>();
export type Money = z.infer<typeof Money>;

/** Signed money (e.g., refunds, adjustments). */
export const SignedMoney = z.bigint().brand<'SignedMoney'>();
export type SignedMoney = z.infer<typeof SignedMoney>;

export const CurrencyCode = z.literal('IDR'); // v1 is Indonesia-only
export type CurrencyCode = z.infer<typeof CurrencyCode>;

export const Locale = z.enum(['id-ID', 'en-US']);
export type Locale = z.infer<typeof Locale>;

/** ISO timestamp as string (we parse to Date at I/O boundaries). */
export const Timestamp = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;

/** Soft-delete + audit columns shared by every tenant entity. */
export const TenantOwnedBase = z.object({
  id: UuidV7,
  tenantId: TenantId,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt: Timestamp.nullable(),
  clientOpId: UuidV7.nullable(),
});
export type TenantOwnedBase = z.infer<typeof TenantOwnedBase>;

/** Cursor pagination params. */
export const CursorPagination = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
export type CursorPagination = z.infer<typeof CursorPagination>;

export const Page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
