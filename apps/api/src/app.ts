import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { loadFeatures } from './middleware/entitlement.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { menuRouter } from './routes/menu.js';
import { orderRouter } from './routes/orders.js';
import { paymentRouter } from './routes/payments.js';
import { syncRouter } from './routes/sync.js';
import { webhookRouter } from './routes/webhooks.js';
import { billingRouter } from './routes/billing.js';
import { reportsRouter } from './routes/reports.js';
import { inventoryRouter } from './routes/inventory.js';
import { tablesRouter } from './routes/tables.js';
import { shiftRouter } from './routes/shifts.js';
import { receiptRouter } from './routes/receipts.js';
import { staffRouter } from './routes/staff.js';
import { tenantRouter } from './routes/tenant.js';
import { outletRouter } from './routes/outlets.js';
import { customerRouter } from './routes/customers.js';
import { auditRouter } from './routes/audit.js';
import { recipeRouter } from './routes/recipes.js';
import { wasteRouter } from './routes/waste.js';
import { deliveryRouter } from './routes/delivery.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { vouchersRouter } from './routes/vouchers.js';
import { signupRouter } from './routes/signup.js';
import { uploadsRouter } from './routes/uploads.js';
import { aiRouter } from './routes/ai.js';
import { suppliersRouter } from './routes/suppliers.js';
import { efakturRouter } from './routes/efaktur.js';
import type { RequestVars } from './context.js';

export function buildApp() {
  const app = new Hono<{ Variables: RequestVars }>();
  const cfg = env();

  app.use('*', requestId);
  app.use('*', secureHeaders());
  app.use('*', honoLogger());
  app.use(
    '*',
    cors({
      origin: cfg.API_CORS_ORIGINS.split(','),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.onError(errorHandler);

  app.route('/', healthRouter);
  app.route('/v1/auth', authRouter);
  app.route('/v1/signup', signupRouter);

  // Feature flags loaded for /v1 endpoints requiring it.
  app.use('/v1/*', loadFeatures);

  app.route('/v1/menu', menuRouter);
  app.route('/v1/orders', orderRouter);
  app.route('/v1/payments', paymentRouter);
  app.route('/v1/sync', syncRouter);
  app.route('/v1/billing', billingRouter);
  app.route('/v1/reports', reportsRouter);
  app.route('/v1/inventory', inventoryRouter);
  app.route('/v1/tables', tablesRouter);
  app.route('/v1/shifts', shiftRouter);
  app.route('/v1/orders', receiptRouter); // /:id/text and /:id/escpos
  app.route('/v1/staff', staffRouter);
  app.route('/v1/tenant', tenantRouter);
  app.route('/v1/outlets', outletRouter);
  app.route('/v1/customers', customerRouter);
  app.route('/v1/audit', auditRouter);
  app.route('/v1/recipes', recipeRouter);
  app.route('/v1/waste', wasteRouter);
  app.route('/v1/delivery', deliveryRouter);
  app.route('/v1/loyalty', loyaltyRouter);
  app.route('/v1/vouchers', vouchersRouter);
  app.route('/v1/uploads', uploadsRouter);
  app.route('/v1/ai', aiRouter);
  app.route('/v1/suppliers', suppliersRouter);
  app.route('/v1/efaktur', efakturRouter);
  app.route('/v1/webhooks', webhookRouter);

  return app;
}
