/**
 * Canonical product-funnel event names. Call sites may still send a legacy
 * name; normalizeAnalyticsEvent keeps those call sites query-compatible while
 * the warehouse receives one stable taxonomy.
 */
export const ANALYTICS_SCHEMA_VERSION = 1;

export const CANONICAL_ANALYTICS_EVENTS = [
  'session_started',
  'onboarding_started',
  'onboarding_step_completed',
  'onboarding_completed',
  'onboarding_skipped',
  'onboarding_shared',
  'first_useful_look_viewed',
  'account_created',
  'look_impression',
  'look_saved',
  'look_passed',
  'look_pass_undone',
  'look_shared',
  'look_remixed',
  'piece_replacement_started',
  'piece_replacement_completed',
  'piece_replacement_failed',
  'product_viewed',
  'product_saved',
  'product_unsaved',
  'shop_sheet_viewed',
  'retailer_click_started',
  'affiliate_redirect_succeeded',
  'affiliate_redirect_failed',
  'search_performed',
  'search_empty_results',
  'catalog_filter_changed',
  'catalog_filters_cleared',
  'recommendation_filter_changed',
  'piece_lock_toggled',
  'product_styling_started',
  'products_saved',
  'look_post_created',
  'profile_preference_changed',
  'local_data_clear_requested',
  'daily_drop_viewed',
  'daily_drop_opened',
  'daily_drop_shopped',
  'reward_opened',
  'catalog_product_verified',
  'catalog_product_published',
  'catalog_product_retired',
  'catalog_outfit_repaired',
  'catalog_pipeline_failed',
  'web_vital_measured',
] as const;

export type CanonicalAnalyticsEvent = (typeof CANONICAL_ANALYTICS_EVENTS)[number];

/** Existing names are aliases, not a second taxonomy. */
export const LEGACY_EVENT_ALIASES: Readonly<Record<string, CanonicalAnalyticsEvent>> = {
  quiz_started: 'onboarding_started',
  quiz_step: 'onboarding_step_completed',
  quiz_completed: 'onboarding_completed',
  quiz_skipped: 'onboarding_skipped',
  quiz_shared: 'onboarding_shared',
  look_loved: 'look_saved',
  look_passed: 'look_passed',
  look_pass_undone: 'look_pass_undone',
  look_shared: 'look_shared',
  taste_map_remixed: 'look_remixed',
  piece_swapped: 'piece_replacement_completed',
  shop_preview_opened: 'product_viewed',
  look_shopped: 'shop_sheet_viewed',
  shop_link_clicked: 'retailer_click_started',
  product_saved: 'product_saved',
  product_unsaved: 'product_unsaved',
  search_empty_results: 'search_empty_results',
  catalog_filter_changed: 'catalog_filter_changed',
  catalog_filters_cleared: 'catalog_filters_cleared',
  browse_style_this: 'product_styling_started',
  discover_look_opened: 'look_remixed',
  feed_budget_changed: 'recommendation_filter_changed',
  lock_toggled: 'piece_lock_toggled',
  pieces_saved: 'products_saved',
  post_created: 'look_post_created',
  saved_fit_shared: 'look_shared',
  share_page_lock: 'piece_lock_toggled',
  share_page_remix: 'look_remixed',
  slot_toggled: 'recommendation_filter_changed',
  vibe_selected: 'recommendation_filter_changed',
  profile_preference_changed: 'profile_preference_changed',
  local_data_clear_requested: 'local_data_clear_requested',
  drop_opened: 'daily_drop_viewed',
  crate_opened: 'daily_drop_opened',
  drop_shopped: 'daily_drop_shopped',
  vault_reshopped: 'daily_drop_shopped',
};

export interface NormalizedAnalyticsEvent {
  event: string;
  legacyEvent?: string;
}

const CANONICAL_EVENT_SET = new Set<string>(CANONICAL_ANALYTICS_EVENTS);

export function isCanonicalAnalyticsEvent(event: string): event is CanonicalAnalyticsEvent {
  return CANONICAL_EVENT_SET.has(event);
}

export function normalizeAnalyticsEvent(event: string): NormalizedAnalyticsEvent {
  const normalized = event.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const safeEvent = normalized || 'unknown_event';
  const canonical = LEGACY_EVENT_ALIASES[safeEvent];
  return canonical
    ? { event: canonical, legacyEvent: safeEvent === canonical ? undefined : safeEvent }
    : { event: safeEvent };
}

/** Stable, bounded fallback ID for surfaces whose look is defined by products. */
export function buildAnalyticsLookId(prefix: string, productIds: readonly string[]): string {
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'look';
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean))).sort();
  const signature = uniqueProductIds.join('|');
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${safePrefix}_${(hash >>> 0).toString(36)}_${uniqueProductIds.length}`;
}

export function analyticsEventProperties(
  event: NormalizedAnalyticsEvent,
  properties: Record<string, unknown> = {},
): Record<string, unknown> {
  const normalizedProperties: Record<string, unknown> = { ...properties };
  const propertyAliases: Record<string, string> = {
    lookId: 'look_id',
    productId: 'product_id',
    productIds: 'product_ids',
    previousProductId: 'previous_product_id',
    priceCents: 'price_cents',
    totalCents: 'total_cents',
    previousTotalCents: 'previous_total_cents',
    maxTotalCents: 'max_total_cents',
    fullyBuyable: 'fully_buyable',
    hasCaption: 'has_caption',
    timeToFirstUsefulLookMs: 'time_to_first_useful_look_ms',
    stepKey: 'step_key',
    totalSteps: 'total_steps',
    resultCount: 'result_count',
    filterCount: 'filter_count',
    crateId: 'crate_id',
    routePath: 'route_path',
    path: 'route_path',
    pipelineRunId: 'pipeline_run_id',
    errorCode: 'error_code',
  };
  for (const [legacyKey, canonicalKey] of Object.entries(propertyAliases)) {
    if (properties[legacyKey] !== undefined && normalizedProperties[canonicalKey] === undefined) {
      normalizedProperties[canonicalKey] = properties[legacyKey];
    }
    if (legacyKey !== canonicalKey) delete normalizedProperties[legacyKey];
  }
  normalizedProperties.schema_version = ANALYTICS_SCHEMA_VERSION;
  normalizedProperties.surface = normalizedProperties.surface || 'unknown';
  if (event.legacyEvent) normalizedProperties.legacy_event = event.legacyEvent;

  const contractIssues = analyticsEventContractIssues(event.event, normalizedProperties);
  if (contractIssues.length) normalizedProperties.event_contract_issues = contractIssues;
  return normalizedProperties;
}

interface AnalyticsEventPropertyRule {
  allOf?: readonly string[];
  anyOf?: readonly string[];
}

/**
 * Lightweight event-quality contract. Violations are attached to the event as
 * `event_contract_issues` rather than throwing or dropping analytics; product
 * behavior must remain independent of measurement availability.
 */
export const ANALYTICS_EVENT_PROPERTY_RULES: Readonly<Partial<Record<CanonicalAnalyticsEvent, AnalyticsEventPropertyRule>>> = {
  session_started: { allOf: ['is_returning'] },
  onboarding_step_completed: { allOf: ['step', 'step_key'] },
  onboarding_completed: { allOf: ['budget', 'fit', 'frame'] },
  first_useful_look_viewed: { allOf: ['look_id', 'time_to_first_useful_look_ms', 'fully_buyable'] },
  look_impression: { allOf: ['look_id', 'vibe', 'pieces', 'total_cents', 'source', 'budget', 'fully_buyable'] },
  look_saved: { allOf: ['look_id'] },
  look_passed: { allOf: ['look_id'] },
  look_pass_undone: { allOf: ['look_id'] },
  look_shared: { allOf: ['look_id'] },
  look_remixed: { allOf: ['look_id'] },
  look_post_created: { allOf: ['look_id', 'product_ids'] },
  piece_replacement_started: { allOf: ['look_id', 'product_id', 'category'] },
  piece_replacement_completed: { allOf: ['look_id', 'product_id', 'category'] },
  piece_replacement_failed: { allOf: ['look_id', 'product_id', 'category', 'error_code'] },
  product_viewed: { allOf: ['product_id'] },
  product_saved: { allOf: ['product_id'] },
  product_unsaved: { allOf: ['product_id'] },
  product_styling_started: { allOf: ['product_id'] },
  piece_lock_toggled: { allOf: ['product_id'] },
  products_saved: { allOf: ['product_ids'] },
  shop_sheet_viewed: { anyOf: ['look_id', 'product_id', 'product_ids'] },
  retailer_click_started: { allOf: ['product_id'] },
  affiliate_redirect_succeeded: { allOf: ['product_id', 'destination_host'] },
  affiliate_redirect_failed: { allOf: ['error_code'] },
  search_performed: { allOf: ['result_count'], anyOf: ['query', 'filter_count'] },
  search_empty_results: { allOf: ['result_count'] },
  catalog_filter_changed: { allOf: ['filter', 'value'] },
  daily_drop_opened: { allOf: ['crate_id'] },
  daily_drop_shopped: { allOf: ['look_id', 'product_ids'] },
  reward_opened: { allOf: ['look_id'] },
  catalog_product_verified: { allOf: ['product_id'] },
  catalog_product_published: { allOf: ['product_id'] },
  catalog_product_retired: { allOf: ['product_id'] },
  catalog_outfit_repaired: { allOf: ['look_id', 'product_ids'] },
  catalog_pipeline_failed: { allOf: ['pipeline_run_id', 'stage', 'error_code'] },
  web_vital_measured: { allOf: ['metric', 'value', 'rating', 'device_type', 'viewport_width', 'route_path'] },
};

function meaningfulProperty(properties: Record<string, unknown>, key: string): boolean {
  const value = properties[key];
  if (value === undefined || value === null || value === '') return false;
  if (key === 'surface' && value === 'unknown') return false;
  return true;
}

export function analyticsEventContractIssues(
  event: string,
  properties: Record<string, unknown>,
): string[] {
  if (!isCanonicalAnalyticsEvent(event)) return ['event:not_canonical'];
  const issues = meaningfulProperty(properties, 'surface') ? [] : ['missing:surface'];
  const rule = ANALYTICS_EVENT_PROPERTY_RULES[event];
  if (!rule) return issues;
  issues.push(...(rule.allOf || [])
    .filter((key) => !meaningfulProperty(properties, key))
    .map((key) => `missing:${key}`));
  if (rule.anyOf?.length && !rule.anyOf.some((key) => meaningfulProperty(properties, key))) {
    issues.push(`missing_any:${rule.anyOf.join('|')}`);
  }
  return issues;
}
