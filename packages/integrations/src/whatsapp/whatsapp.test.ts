import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WhatsAppProvider } from './index.js';

describe('WhatsAppProvider', () => {
  const provider = new WhatsAppProvider({
    phoneNumberId: '123',
    accessToken: 'shhh-secret',
    webhookVerifyToken: 'verify-token-x',
  });

  it('verifyWebhookChallenge returns the challenge on valid token', () => {
    const out = provider.verifyWebhookChallenge({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token-x',
      'hub.challenge': 'abc123',
    });
    expect(out).toBe('abc123');
  });

  it('verifyWebhookChallenge throws on bad token', () => {
    expect(() =>
      provider.verifyWebhookChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong',
        'hub.challenge': 'abc',
      }),
    ).toThrow();
  });

  it('verifyWebhookSignature rejects mismatched signature', () => {
    const body = '{"hello":"world"}';
    expect(() =>
      provider.verifyWebhookSignature({ 'x-hub-signature-256': 'sha256=deadbeef' }, body),
    ).toThrow();
  });

  it('verifyWebhookSignature accepts correct signature', () => {
    const body = '{"hello":"world"}';
    const sig = createHmac('sha256', 'shhh-secret').update(body).digest('hex');
    expect(() =>
      provider.verifyWebhookSignature({ 'x-hub-signature-256': `sha256=${sig}` }, body),
    ).not.toThrow();
  });

  it('verifyWebhookSignature throws when header missing', () => {
    expect(() => provider.verifyWebhookSignature({}, '{}')).toThrow();
  });
});
