/**
 * Meta WhatsApp Business Platform adapter. Direct integration (no reseller).
 * AGENTS.md §3.3 — "we hit volume fast".
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type WhatsAppConfig = {
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  graphApiVersion?: string; // default v21.0
};

export type WhatsAppTemplate = {
  name: string;
  language: 'id' | 'en' | string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters?: Array<{ type: 'text' | 'currency' | 'date_time' | 'image'; text?: string; image?: { link: string } }>;
  }>;
};

export type SendTemplateInput = {
  to: string; // E.164
  template: WhatsAppTemplate;
};

export class WhatsAppProvider {
  constructor(private readonly cfg: WhatsAppConfig) {}

  private get apiBase(): string {
    return `https://graph.facebook.com/${this.cfg.graphApiVersion ?? 'v21.0'}/${this.cfg.phoneNumberId}`;
  }

  async sendTemplate(input: SendTemplateInput): Promise<{ messageId: string }> {
    const res = await fetch(`${this.apiBase}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.cfg.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: input.template,
      }),
    });
    if (!res.ok) throw new Error(`whatsapp send failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { messages: Array<{ id: string }> };
    const msg = json.messages?.[0];
    if (!msg) throw new Error('whatsapp send: no message id');
    return { messageId: msg.id };
  }

  /** Used to verify webhook subscription (GET request from Meta). */
  verifyWebhookChallenge(query: { ['hub.mode']?: string; ['hub.verify_token']?: string; ['hub.challenge']?: string }): string {
    if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== this.cfg.webhookVerifyToken) {
      throw new Error('whatsapp webhook verification failed');
    }
    return query['hub.challenge'] ?? '';
  }

  /**
   * Verify the X-Hub-Signature-256 header on inbound webhooks.
   * Meta signs with the App Secret; for dev the access token is used per AGENTS.md decision.
   */
  verifyWebhookSignature(headers: Record<string, string | undefined>, rawBody: string): void {
    const provided = headers['x-hub-signature-256']?.replace(/^sha256=/, '');
    if (!provided) throw new Error('whatsapp signature missing');
    const expected = createHmac('sha256', this.cfg.accessToken).update(rawBody).digest('hex');
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('whatsapp signature mismatch');
    }
  }
}
