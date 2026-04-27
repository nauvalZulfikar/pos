export * from './types.js';
export { GoFoodProvider } from './gofood/index.js';
export { GrabFoodProvider } from './grabfood/index.js';
export { ShopeeFoodProvider } from './shopeefood/index.js';

import type { DeliveryProvider, PlatformId } from './types.js';
import { GoFoodProvider } from './gofood/index.js';
import { GrabFoodProvider } from './grabfood/index.js';
import { ShopeeFoodProvider } from './shopeefood/index.js';

export type DeliveryConfigBundle = {
  gofood?: ConstructorParameters<typeof GoFoodProvider>[0];
  grabfood?: ConstructorParameters<typeof GrabFoodProvider>[0];
  shopeefood?: ConstructorParameters<typeof ShopeeFoodProvider>[0];
};

export function buildDeliveryProvider(
  id: PlatformId,
  cfg: DeliveryConfigBundle,
): DeliveryProvider {
  if (id === 'gofood') {
    if (!cfg.gofood) throw new Error('gofood config missing');
    return new GoFoodProvider(cfg.gofood);
  }
  if (id === 'grabfood') {
    if (!cfg.grabfood) throw new Error('grabfood config missing');
    return new GrabFoodProvider(cfg.grabfood);
  }
  if (id === 'shopeefood') {
    if (!cfg.shopeefood) throw new Error('shopeefood config missing');
    return new ShopeeFoodProvider(cfg.shopeefood);
  }
  throw new Error(`unknown platform: ${id satisfies never}`);
}
