export type SubscriptionTier = 'free' | 'plus' | 'premium';
export type UserRole = 'super_admin' | 'support_admin' | 'enterprise' | 'specialist' | 'assistant';
export type BillingMode = 'free_launch' | 'manual_billing' | 'stripe_live';
export type SubscriptionOrigin =
  | 'free_default'
  | 'launch_promo'
  | 'admin_grant'
  | 'enterprise_license'
  | 'promo_code'
  | 'manual_payment'
  | 'stripe'
  | 'mercadopago';

export type FeatureKey =
  | 'calculator.use'
  | 'calculator.print_session'
  | 'calculator.export_session'
  | 'treatments.persist'
  | 'patients.manage'
  | 'agenda.manage'
  | 'templates.manage'
  | 'offline.sync'
  | 'data.export'
  | 'guides.anatomy'
  | 'guides.usg'
  | 'content.protocols'
  | 'content.videos'
  | 'content.clinical_pearls';

export type FeatureMap = Record<FeatureKey, boolean>;

export const ALL_FEATURE_KEYS: { key: FeatureKey; label: string; minTier: SubscriptionTier; group: 'base' | 'plus' | 'premium' }[] = [
  { key: 'calculator.use', label: 'Calculadora por marca (Botox / Dysport / Xeomin)', minTier: 'free', group: 'base' },
  { key: 'calculator.print_session', label: 'Imprimir hoja de sesión actual', minTier: 'free', group: 'base' },
  { key: 'calculator.export_session', label: 'Copiar / exportar CSV de la sesión', minTier: 'free', group: 'base' },
  { key: 'data.export', label: 'Exportar respaldo histórico (CSV)', minTier: 'free', group: 'base' },
  { key: 'treatments.persist', label: 'Guardar tratamientos e historial en BD', minTier: 'plus', group: 'plus' },
  { key: 'patients.manage', label: 'Gestión de expedientes, notas y metas GAS', minTier: 'plus', group: 'plus' },
  { key: 'agenda.manage', label: 'Agenda, citas, horarios y recordatorios', minTier: 'plus', group: 'plus' },
  { key: 'templates.manage', label: 'Plantillas clínicas personales', minTier: 'plus', group: 'plus' },
  { key: 'offline.sync', label: 'Sincronización Offline PWA', minTier: 'plus', group: 'plus' },
  { key: 'guides.anatomy', label: 'Guía anatómica, puntos motores y planificador facial', minTier: 'premium', group: 'premium' },
  { key: 'guides.usg', label: 'Guía ecográfica (USG) HD, vistas y precauciones', minTier: 'premium', group: 'premium' },
  { key: 'content.protocols', label: 'Protocolos prediseñados por patología', minTier: 'premium', group: 'premium' },
  { key: 'content.videos', label: 'Videos de procedimientos guiados', minTier: 'premium', group: 'premium' },
  { key: 'content.clinical_pearls', label: 'Perlas clínicas de técnica de aplicación', minTier: 'premium', group: 'premium' },
];

export const TIER_DEFAULT_FEATURES: Record<SubscriptionTier, FeatureMap> = {
  free: {
    'calculator.use': true,
    'calculator.print_session': true,
    'calculator.export_session': true,
    'data.export': true,
    'treatments.persist': false,
    'patients.manage': false,
    'agenda.manage': false,
    'templates.manage': false,
    'offline.sync': false,
    'guides.anatomy': false,
    'guides.usg': false,
    'content.protocols': false,
    'content.videos': false,
    'content.clinical_pearls': false,
  },
  plus: {
    'calculator.use': true,
    'calculator.print_session': true,
    'calculator.export_session': true,
    'data.export': true,
    'treatments.persist': true,
    'patients.manage': true,
    'agenda.manage': true,
    'templates.manage': true,
    'offline.sync': true,
    'guides.anatomy': false,
    'guides.usg': false,
    'content.protocols': false,
    'content.videos': false,
    'content.clinical_pearls': false,
  },
  premium: {
    'calculator.use': true,
    'calculator.print_session': true,
    'calculator.export_session': true,
    'data.export': true,
    'treatments.persist': true,
    'patients.manage': true,
    'agenda.manage': true,
    'templates.manage': true,
    'offline.sync': true,
    'guides.anatomy': true,
    'guides.usg': true,
    'content.protocols': true,
    'content.videos': true,
    'content.clinical_pearls': true,
  },
};

export interface SubscriptionPlanRecord {
  id: string;
  slug: string;
  tier: SubscriptionTier;
  scope: 'individual' | 'clinic' | 'enterprise';
  name: string;
  description: string | null;
  badge_text: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  currency: string;
  max_seats: number;
  features: Partial<FeatureMap>;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_annual_id: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

export const FALLBACK_PLANS: SubscriptionPlanRecord[] = [
  {
    id: 'fallback-free',
    slug: 'free',
    tier: 'free',
    scope: 'individual',
    name: 'Plan Gratuito',
    description: 'Calculadora clínica por marca (Botox, Dysport, Xeomin) con impresión y exportación de la sesión actual.',
    badge_text: null,
    price_monthly_cents: 0,
    price_annual_cents: 0,
    currency: 'MXN',
    max_seats: 1,
    features: TIER_DEFAULT_FEATURES.free,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_annual_id: null,
    is_active: true,
    is_featured: false,
    sort_order: 1,
  },
  {
    id: 'fallback-plus',
    slug: 'plus_solo',
    tier: 'plus',
    scope: 'individual',
    name: 'Plan Plus',
    description: 'Expedientes completos, historial longitudinal de dosis, metas GAS, agenda inteligente y modo offline PWA.',
    badge_text: 'Práctica Clínica',
    price_monthly_cents: 29900,
    price_annual_cents: 299000,
    currency: 'MXN',
    max_seats: 1,
    features: TIER_DEFAULT_FEATURES.plus,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_annual_id: null,
    is_active: true,
    is_featured: false,
    sort_order: 2,
  },
  {
    id: 'fallback-premium',
    slug: 'premium_solo',
    tier: 'premium',
    scope: 'individual',
    name: 'Plan Premium',
    description: 'Acceso total: expedientes + agenda + guía anatómica, puntos motores, ecografía USG, planificador facial, protocolos y perlas clínicas.',
    badge_text: 'Más popular',
    price_monthly_cents: 59900,
    price_annual_cents: 599000,
    currency: 'MXN',
    max_seats: 1,
    features: TIER_DEFAULT_FEATURES.premium,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_annual_id: null,
    is_active: true,
    is_featured: true,
    sort_order: 3,
  },
  {
    id: 'fallback-plus-clinic',
    slug: 'plus_clinic',
    tier: 'plus',
    scope: 'clinic',
    name: 'Plus Clínica (5 asientos)',
    description: 'Gestión multi-especialista con pacientes compartidos por sede, horarios operativos y agenda coordinada.',
    badge_text: 'Clínicas',
    price_monthly_cents: 99900,
    price_annual_cents: 999000,
    currency: 'MXN',
    max_seats: 5,
    features: TIER_DEFAULT_FEATURES.plus,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_annual_id: null,
    is_active: true,
    is_featured: false,
    sort_order: 4,
  },
  {
    id: 'fallback-premium-clinic',
    slug: 'premium_clinic',
    tier: 'premium',
    scope: 'clinic',
    name: 'Premium Clínica (5 asientos)',
    description: 'Acceso clínico completo + guías USG/anatómicas + protocolos para todo el equipo de tu sede.',
    badge_text: 'Clínicas Pro',
    price_monthly_cents: 199900,
    price_annual_cents: 1999000,
    currency: 'MXN',
    max_seats: 5,
    features: TIER_DEFAULT_FEATURES.premium,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_annual_id: null,
    is_active: true,
    is_featured: true,
    sort_order: 5,
  },
];

export const ORIGIN_LABELS: Record<SubscriptionOrigin, string> = {
  free_default: 'Plan Base Gratuito',
  launch_promo: 'Acceso de Lanzamiento (Fundador)',
  admin_grant: 'Otorgado por Administración',
  enterprise_license: 'Licencia Enterprise Patrocinada',
  promo_code: 'Código Promocional',
  manual_payment: 'Pago Registrado',
  stripe: 'Suscripción Stripe',
  mercadopago: 'Suscripción MercadoPago',
};

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Gratuito',
  plus: 'Plus',
  premium: 'Premium',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'SuperAdmin',
  support_admin: 'Soporte Admin',
  enterprise: 'Enterprise (B2B)',
  specialist: 'Especialista',
  assistant: 'Asistente',
};

export function formatMoney(cents: number, currency = 'MXN'): string {
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency}`;
  }
}

export function normalizeTier(raw?: string | null): SubscriptionTier {
  const val = (raw || 'free').trim().toLowerCase();
  if (val === 'premium' || val === 'pro' || val === 'enterprise') return 'premium';
  if (val === 'plus') return 'plus';
  return 'free';
}

