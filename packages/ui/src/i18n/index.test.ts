import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, t } from './index.js';

describe('i18n', () => {
  it('defaults to id-ID', () => {
    expect(DEFAULT_LOCALE).toBe('id-ID');
  });

  it('looks up nested keys', () => {
    expect(t('id-ID', 'common.save')).toBe('Simpan');
    expect(t('en-US', 'common.save')).toBe('Save');
  });

  it('interpolates {var} placeholders', () => {
    expect(t('id-ID', 'auth.pinLockedOut', { minutes: 5 })).toContain('5');
    expect(t('en-US', 'pos.tableLabel', { label: '7' })).toBe('Table 7');
  });

  it('returns key on missing translation', () => {
    expect(t('id-ID', 'totally.missing.key')).toBe('totally.missing.key');
  });

  it('falls back to default locale on unknown locale', () => {
    expect(t('xx-XX' as never, 'common.save')).toBe('Simpan');
  });
});
