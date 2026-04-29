export * as money from './money.js';
export * as tax from './tax.js';
export * as billing from './billing.js';
export * as entitlement from './entitlement.js';
export * as recipe from './recipe.js';
export * as stockDeduction from './stock-deduction.js';
export * as margin from './margin.js';
export * as receipt from './receipt.js';
export * as order from './order.js';
export * as time from './time.js';
export * as menuScore from './menu-score.js';
export * as demandForecast from './demand-forecast.js';

// Convenience re-exports for common helpers
export { fromRupiah, formatIDR, sum as sumMoney } from './money.js';
export type { Sen } from './money.js';
export { computeTax, quickTotal } from './tax.js';
export type { TaxBreakdown, TaxInput } from './tax.js';
export { computeMonthlyBill, activeFeatureCodes } from './billing.js';
export type { BillResult, BillingTier, EnabledFeatureRef } from './billing.js';
export {
  hasFeature,
  requireFeature,
  requireAnyFeature,
  requireAllFeatures,
  buildFeatureMap,
} from './entitlement.js';
export type { FeatureMap, RequestContextFeatures } from './entitlement.js';
export { computeOrderTotals, computeLineSubtotal } from './order.js';
export type { OrderTotals, OrderTotalsInput } from './order.js';
export { computeRecipeCost, recipeDeductions } from './recipe.js';
export type {
  RecipeInput,
  RecipeIngredientInput,
  RecipeCostInput,
  RecipeCostBreakdown,
  InventoryCostLookup,
} from './recipe.js';
export { planRecipeDeductions } from './stock-deduction.js';
export type { DeductionPlan, IngredientDelta, SoldLine } from './stock-deduction.js';
export { computeMargin } from './margin.js';
export { classify as classifyMenuPerformance, median, medianBig, rationaleFor } from './menu-score.js';
export type { MenuCategory, MenuScoreInput } from './menu-score.js';
export {
  bucketize,
  forecast as forecastDemand,
  isHoliday2026,
  ID_HOLIDAYS_2026,
} from './demand-forecast.js';
export type { Sample as DemandSample, Bucket as DemandBucket, ForecastResult } from './demand-forecast.js';
export { renderReceiptText, textToEscPos } from './receipt.js';
export { businessDayFor, jakartaIsoDate } from './time.js';
export type { BusinessDay } from './time.js';
