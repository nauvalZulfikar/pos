export * from './types.js';
export { MidtransProvider } from './midtrans.js';
export { XenditProvider } from './xendit.js';

import type { PaymentProvider, ProviderId } from './types.js';
import { MidtransProvider } from './midtrans.js';
import { XenditProvider } from './xendit.js';

/** Pick provider by id with config bundle. */
export function buildPaymentProvider(
  id: ProviderId,
  cfg: { midtrans?: ConstructorParameters<typeof MidtransProvider>[0]; xendit?: ConstructorParameters<typeof XenditProvider>[0] },
): PaymentProvider {
  if (id === 'midtrans') {
    if (!cfg.midtrans) throw new Error('midtrans config missing');
    return new MidtransProvider(cfg.midtrans);
  }
  if (id === 'xendit') {
    if (!cfg.xendit) throw new Error('xendit config missing');
    return new XenditProvider(cfg.xendit);
  }
  throw new Error(`unknown provider: ${id}`);
}
