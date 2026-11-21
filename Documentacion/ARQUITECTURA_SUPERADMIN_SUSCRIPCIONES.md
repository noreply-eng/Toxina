# Arquitectura Implementada: SuperAdmin, Suscripciones, Modo Lanzamiento Gratuito, Enterprise (B2B2C x20) y Stripe-Ready

- **SuperAdmin oculto (`/super-admin`)**: verificado únicamente en PostgreSQL (`public.is_super_admin()`), cargado con `React.lazy()` y redirección silenciosa para no-admins.
- **Modo Lanzamiento Gratuito (`free_launch`)**: todos los planes activables a `$0 MXN` en `/subscription` con cohorte Fundador (`is_founder = true`).
- **Permisos Premium Manuales**: otorgar/revocar planes con duración personalizada o vitalicia, `protected_from_auto_downgrade` y `feature_overrides` granulares.
- **Enterprise B2B2C (`/enterprise`)**: farmacéuticas (Allergan, Ipsen, Merz), escuelas e instituciones compran licencias en **múltiplos de 20** y distribuyen cupones de marca que otorgan **consultorios privados Premium sin compartir pacientes (Zero-PHI)**.
- **Stripe-Ready**: tablas `billing_*`, `stripe_price_*_id` (incluyendo `enterprise_batch_20`), Edge Functions en `supabase/functions/` y Checklist Pre-Flight antes de activar `stripe_live`.

## Migraciones SQL (100% idempotentes)
Ejecutar en orden (o `supabase db push`):
1. `supabase/migrations/20261120100000_rbac_clinics_and_enterprise.sql`
2. `supabase/migrations/20261120101000_subscriptions_billing_and_enterprise_grants.sql`
3. `supabase/migrations/20261120102000_premium_cms_videos_pearls_protocols.sql`
4. `supabase/migrations/20261120103000_super_admin_clinic_and_enterprise_rpcs.sql`
