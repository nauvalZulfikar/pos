/**
 * BCG-matrix classifier for menu items. Used by the menu-score worker and
 * referenced by the proposal §6.2 / §7.6.
 */

export type MenuCategory = 'bintang' | 'sapi_perah' | 'tanda_tanya' | 'anjing';

export type MenuScoreInput = {
  /** Sold units in the period. */
  qty: number;
  /** Gross margin (revenue − cost) in sen. */
  margin: bigint;
  /** Tenant-wide median qty (cutoff for high-volume). */
  qtyCutoff: number;
  /** Tenant-wide median margin (cutoff for high-margin). */
  marginCutoff: bigint;
};

export function classify(input: MenuScoreInput): MenuCategory {
  const highVolume = input.qty >= input.qtyCutoff;
  const highMargin = input.margin >= input.marginCutoff;
  if (highVolume && highMargin) return 'bintang';
  if (highVolume && !highMargin) return 'sapi_perah';
  if (!highVolume && highMargin) return 'tanda_tanya';
  return 'anjing';
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.floor((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

export function medianBig(arr: bigint[]): bigint {
  if (arr.length === 0) return BigInt(0);
  const sorted = [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / BigInt(2);
  }
  return sorted[mid]!;
}

export function rationaleFor(category: MenuCategory, name: string): string {
  switch (category) {
    case 'bintang':
      return `${name} laris dan margin tinggi — pertahankan kualitas, promosikan terus`;
    case 'sapi_perah':
      return `${name} laris tapi margin tipis — coba naikkan harga sedikit atau kurangi food cost`;
    case 'tanda_tanya':
      return `${name} margin bagus tapi kurang laris — pertimbangkan promosi atau reposisi`;
    case 'anjing':
      return `${name} kurang laris dan margin rendah — kandidat untuk dihapus dari menu`;
  }
}
