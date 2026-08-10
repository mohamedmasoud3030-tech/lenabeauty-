-- =============================================================================
-- LenaBeauty Arabic service catalog — DEMO/STAGING ONLY
-- =============================================================================
-- This file is deliberately outside supabase/migrations: it is never applied to
-- production by the migration chain. It inserts no products, packages, sales,
-- payments, customers, or appointments.
--
-- Explicit operator gate (same SQL session):
--   SET app.seed_environment = 'demo';
--   SET app.seed_center_id = 'YOUR-DEMO-CENTER-UUID';
-- Then run this file. Running it without both settings aborts before any DML.
-- Review prices with the salon operator before using the catalog commercially.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_environment TEXT := current_setting('app.seed_environment', true);
  v_center_id UUID;
BEGIN
  IF v_environment NOT IN ('demo', 'staging') THEN
    RAISE EXCEPTION 'Catalog seed is restricted to demo/staging';
  END IF;

  BEGIN
    v_center_id := current_setting('app.seed_center_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'A valid app.seed_center_id is required';
  END;

  PERFORM 1 FROM public.centers WHERE id = v_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demo/staging center does not exist';
  END IF;
END;
$$;

INSERT INTO public.service_categories (center_id, name)
SELECT current_setting('app.seed_center_id')::uuid, category_name
FROM (VALUES
  ('الشعر'),
  ('الأظافر'),
  ('العناية بالوجه'),
  ('إزالة الشعر'),
  ('المكياج'),
  ('الحناء')
) AS categories(category_name)
ON CONFLICT (center_id, name) DO NOTHING;

WITH catalog(catalog_code, service_name, category_name, duration_minutes, pricing_mode, price) AS (
  VALUES
    ('HAIR-CUT',             'قص الشعر',                    'الشعر',          30,  'FIXED',        8.000::numeric),
    ('HAIR-BLOWDRY-SHORT',   'استشوار شعر قصير',            'الشعر',          30,  'FIXED',        5.000::numeric),
    ('HAIR-BLOWDRY-MEDIUM',  'استشوار شعر متوسط',           'الشعر',          45,  'FIXED',        7.000::numeric),
    ('HAIR-BLOWDRY-LONG',    'استشوار شعر طويل',            'الشعر',          60,  'FIXED',       10.000::numeric),
    ('HAIR-STYLE',           'تسريحة شعر',                  'الشعر',          60,  'STARTING_FROM',12.000::numeric),
    ('HAIR-ROOT-COLOR',      'صبغة جذور',                   'الشعر',          90,  'STARTING_FROM',18.000::numeric),
    ('HAIR-FULL-COLOR',      'صبغة شعر كاملة',              'الشعر',         120,  'STARTING_FROM',30.000::numeric),
    ('HAIR-HIGHLIGHTS',      'خصل وهايلايت',                'الشعر',         150,  'STARTING_FROM',35.000::numeric),
    ('HAIR-KERATIN',         'علاج كيراتين للشعر',          'الشعر',         180,  'STARTING_FROM',45.000::numeric),
    ('HAIR-OIL-TREATMENT',   'حمام زيت للشعر',              'الشعر',          45,  'FIXED',       10.000::numeric),

    ('NAIL-MANICURE',        'مانيكير',                      'الأظافر',         45,  'FIXED',        6.000::numeric),
    ('NAIL-PEDICURE',        'بديكير',                       'الأظافر',         60,  'FIXED',        8.000::numeric),
    ('NAIL-POLISH',          'طلاء أظافر عادي',             'الأظافر',         20,  'FIXED',        3.000::numeric),
    ('NAIL-GEL-HANDS',       'جل أظافر لليدين',             'الأظافر',         60,  'FIXED',       10.000::numeric),
    ('NAIL-GEL-FEET',        'جل أظافر للقدمين',            'الأظافر',         60,  'FIXED',       12.000::numeric),
    ('NAIL-GEL-REMOVAL',     'إزالة جل الأظافر',            'الأظافر',         20,  'FIXED',        3.000::numeric),

    ('FACE-CLEAN-BASIC',     'تنظيف بشرة أساسي',            'العناية بالوجه', 60,  'FIXED',       15.000::numeric),
    ('FACE-CLEAN-DEEP',      'تنظيف بشرة عميق',             'العناية بالوجه', 90,  'FIXED',       25.000::numeric),
    ('FACE-BROWS-THREAD',    'تنظيف الحواجب بالخيط',        'العناية بالوجه', 15,  'FIXED',        3.000::numeric),
    ('FACE-UPPER-LIP',       'إزالة شعر الشفة العليا بالخيط','العناية بالوجه', 10,  'FIXED',        2.000::numeric),
    ('FACE-FULL-THREAD',     'إزالة شعر الوجه كامل بالخيط', 'العناية بالوجه', 30,  'FIXED',        8.000::numeric),

    ('WAX-UNDERARMS',        'واكس تحت الإبط',              'إزالة الشعر',     20,  'FIXED',        5.000::numeric),
    ('WAX-ARMS',             'واكس اليدين',                 'إزالة الشعر',     30,  'FIXED',        8.000::numeric),
    ('WAX-LEGS',             'واكس الساقين',                'إزالة الشعر',     45,  'FIXED',       12.000::numeric),
    ('WAX-FULL-BODY',        'واكس كامل للجسم',             'إزالة الشعر',     90,  'STARTING_FROM',25.000::numeric),

    ('MAKEUP-SOFT',          'مكياج ناعم',                  'المكياج',         60,  'FIXED',       18.000::numeric),
    ('MAKEUP-EVENING',       'مكياج سهرة',                  'المكياج',         75,  'FIXED',       25.000::numeric),
    ('MAKEUP-BRIDAL',        'مكياج عروس',                  'المكياج',        120,  'STARTING_FROM',60.000::numeric),

    ('HENNA-HANDS',          'حناء لليدين',                 'الحناء',          45,  'STARTING_FROM', 8.000::numeric),
    ('HENNA-FEET',           'حناء للقدمين',                'الحناء',          45,  'STARTING_FROM', 6.000::numeric),
    ('HENNA-BRIDAL',         'حناء عروس',                   'الحناء',         120,  'STARTING_FROM',25.000::numeric)
)
INSERT INTO public.services (
  center_id, category_id, catalog_code, name, duration_minutes,
  pricing_mode, price, is_active
)
SELECT
  current_setting('app.seed_center_id')::uuid,
  category.id,
  catalog.catalog_code,
  catalog.service_name,
  catalog.duration_minutes,
  catalog.pricing_mode,
  catalog.price,
  true
FROM catalog
JOIN public.service_categories category
  ON category.center_id = current_setting('app.seed_center_id')::uuid
 AND category.name = catalog.category_name
ON CONFLICT (center_id, catalog_code) WHERE catalog_code IS NOT NULL
DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  duration_minutes = EXCLUDED.duration_minutes,
  pricing_mode = EXCLUDED.pricing_mode,
  price = EXCLUDED.price,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMIT;
