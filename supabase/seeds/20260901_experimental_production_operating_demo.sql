-- LENA Beauty Experimental Production operating demo seed.
-- Demo-only. Idempotent. No fabricated financial transactions are created.
-- It adds operating inventory, service recipes and appointments so the live
-- trial exercises Action Center, visit lifecycle, recipes and inventory.
-- Existing demo records are never reset on re-run.

DO $$
DECLARE
  v_center uuid := '7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d';
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid;
  s_nails uuid; s_pedi uuid; s_short uuid; s_long uuid; s_style uuid;
  r_nails uuid; r_pedi uuid; r_short uuid; r_long uuid; r_style uuid;
  v_day date := (now() at time zone 'Asia/Muscat')::date;
BEGIN
  SELECT id INTO c1 FROM public.customers WHERE center_id=v_center ORDER BY created_at,id LIMIT 1 OFFSET 0;
  SELECT id INTO c2 FROM public.customers WHERE center_id=v_center ORDER BY created_at,id LIMIT 1 OFFSET 1;
  SELECT id INTO c3 FROM public.customers WHERE center_id=v_center ORDER BY created_at,id LIMIT 1 OFFSET 2;
  SELECT id INTO c4 FROM public.customers WHERE center_id=v_center ORDER BY created_at,id LIMIT 1 OFFSET 3;

  SELECT id INTO e1 FROM public.employees WHERE center_id=v_center AND is_active=true ORDER BY name,id LIMIT 1 OFFSET 0;
  SELECT id INTO e2 FROM public.employees WHERE center_id=v_center AND is_active=true ORDER BY name,id LIMIT 1 OFFSET 1;
  SELECT id INTO e3 FROM public.employees WHERE center_id=v_center AND is_active=true ORDER BY name,id LIMIT 1 OFFSET 2;
  SELECT id INTO e4 FROM public.employees WHERE center_id=v_center AND is_active=true ORDER BY name,id LIMIT 1 OFFSET 3;

  SELECT id INTO s_nails FROM public.services WHERE center_id=v_center AND name='إزالة جل الأظافر' LIMIT 1;
  SELECT id INTO s_pedi  FROM public.services WHERE center_id=v_center AND name='بديكير' LIMIT 1;
  SELECT id INTO s_short FROM public.services WHERE center_id=v_center AND name='استشوار شعر قصير' LIMIT 1;
  SELECT id INTO s_long  FROM public.services WHERE center_id=v_center AND name='استشوار شعر طويل' LIMIT 1;
  SELECT id INTO s_style FROM public.services WHERE center_id=v_center AND name='تسريحة شعر' LIMIT 1;

  IF c4 IS NULL OR e4 IS NULL OR s_nails IS NULL OR s_pedi IS NULL OR s_short IS NULL OR s_long IS NULL OR s_style IS NULL THEN
    RAISE EXCEPTION 'Experimental Production seed prerequisites are incomplete';
  END IF;

  INSERT INTO public.products (id,center_id,name,barcode,price,cost,stock_quantity,reorder_level,is_active,track_inventory)
  VALUES
    ('10000000-0000-4000-8000-000000000001',v_center,'شامبو احترافي — تجريبي','LENA-DEMO-001',6.500,2.100,20,5,true,true),
    ('10000000-0000-4000-8000-000000000002',v_center,'ماسك شعر — تجريبي','LENA-DEMO-002',8.000,3.000,1,4,true,true),
    ('10000000-0000-4000-8000-000000000003',v_center,'مزيل جل أظافر — تجريبي','LENA-DEMO-003',4.000,1.200,12,4,true,true),
    ('10000000-0000-4000-8000-000000000004',v_center,'عدة بديكير — تجريبي','LENA-DEMO-004',5.500,1.800,3,5,true,true),
    ('10000000-0000-4000-8000-000000000005',v_center,'قطن تجميلي — تجريبي','LENA-DEMO-005',2.000,0.500,8,6,true,true),
    ('10000000-0000-4000-8000-000000000006',v_center,'قفازات استخدام واحد — تجريبي','LENA-DEMO-006',3.000,0.700,50,10,true,true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.service_recipes (center_id,service_id,is_active) VALUES (v_center,s_nails,true)
  ON CONFLICT (center_id,service_id) DO NOTHING;
  SELECT id INTO r_nails FROM public.service_recipes WHERE center_id=v_center AND service_id=s_nails;

  INSERT INTO public.service_recipes (center_id,service_id,is_active) VALUES (v_center,s_pedi,true)
  ON CONFLICT (center_id,service_id) DO NOTHING;
  SELECT id INTO r_pedi FROM public.service_recipes WHERE center_id=v_center AND service_id=s_pedi;

  INSERT INTO public.service_recipes (center_id,service_id,is_active) VALUES (v_center,s_short,true)
  ON CONFLICT (center_id,service_id) DO NOTHING;
  SELECT id INTO r_short FROM public.service_recipes WHERE center_id=v_center AND service_id=s_short;

  INSERT INTO public.service_recipes (center_id,service_id,is_active) VALUES (v_center,s_long,true)
  ON CONFLICT (center_id,service_id) DO NOTHING;
  SELECT id INTO r_long FROM public.service_recipes WHERE center_id=v_center AND service_id=s_long;

  INSERT INTO public.service_recipes (center_id,service_id,is_active) VALUES (v_center,s_style,true)
  ON CONFLICT (center_id,service_id) DO NOTHING;
  SELECT id INTO r_style FROM public.service_recipes WHERE center_id=v_center AND service_id=s_style;

  INSERT INTO public.service_recipe_items (center_id,recipe_id,product_id,quantity,unit,estimated_cost)
  VALUES
    (v_center,r_nails,'10000000-0000-4000-8000-000000000003',1,'وحدة',1.200),
    (v_center,r_pedi ,'10000000-0000-4000-8000-000000000004',1,'وحدة',1.800),
    (v_center,r_short,'10000000-0000-4000-8000-000000000001',1,'وحدة',2.100),
    (v_center,r_long ,'10000000-0000-4000-8000-000000000001',1,'وحدة',2.100),
    (v_center,r_long ,'10000000-0000-4000-8000-000000000002',2,'وحدة',6.000),
    (v_center,r_style,'10000000-0000-4000-8000-000000000002',1,'وحدة',3.000)
  ON CONFLICT (recipe_id,product_id) DO NOTHING;

  -- All new appointments are inserted in the only legal initial status:
  -- SCHEDULED. Terminal demo cases are transitioned in later UPDATEs, matching
  -- the database lifecycle contract rather than bypassing the insert guard.
  INSERT INTO public.appointments
    (id,center_id,customer_id,employee_id,service_id,date_time,status,notes,booking_source,duration_minutes_snapshot,visit_stage,started_at,completed_at)
  VALUES
    ('20000000-0000-4000-8000-000000000001',v_center,c1,e1,s_nails,((v_day + time '09:30') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] وصول العميلة','INTERNAL',20,'ARRIVED',null,null),
    ('20000000-0000-4000-8000-000000000002',v_center,c2,e2,s_pedi ,((v_day + time '11:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] الخدمة قيد التنفيذ','INTERNAL',60,'IN_SERVICE',((v_day + time '11:05') at time zone 'Asia/Muscat'),null),
    ('20000000-0000-4000-8000-000000000003',v_center,c3,e3,s_short,((v_day + time '13:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] جاهز للدفع','INTERNAL',30,'READY_FOR_CHECKOUT',((v_day + time '13:02') at time zone 'Asia/Muscat'),null),
    ('20000000-0000-4000-8000-000000000004',v_center,c4,e1,s_long ,(((v_day+1) + time '10:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] موعد مؤكد','INTERNAL',60,'CONFIRMED',null,null),
    ('20000000-0000-4000-8000-000000000005',v_center,c1,e2,s_style,(((v_day+2) + time '15:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] حجز قادم','INTERNAL',60,'BOOKED',null,null),
    ('20000000-0000-4000-8000-000000000006',v_center,c2,e3,s_nails,(((v_day-1) + time '16:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] زيارة مكتملة','INTERNAL',20,'BOOKED',null,null),
    ('20000000-0000-4000-8000-000000000007',v_center,c3,e4,s_pedi ,(((v_day-1) + time '12:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] حالة إلغاء للعرض','INTERNAL',60,'BOOKED',null,null),
    ('20000000-0000-4000-8000-000000000008',v_center,c4,e4,s_short,(((v_day-2) + time '14:00') at time zone 'Asia/Muscat'),'SCHEDULED','[EXPERIMENTAL_PRODUCTION] حالة عدم حضور للعرض','INTERNAL',30,'BOOKED',null,null)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.appointments
  SET status='COMPLETED', visit_stage=NULL,
      started_at=((v_day-1) + time '16:00') at time zone 'Asia/Muscat',
      completed_at=((v_day-1) + time '16:20') at time zone 'Asia/Muscat'
  WHERE id='20000000-0000-4000-8000-000000000006' AND status='SCHEDULED';

  UPDATE public.appointments
  SET status='CANCELLED', visit_stage=NULL,
      cancellation_reason='حالة تجريبية لعرض الاستثناءات',
      cancelled_at=((v_day-1) + time '11:30') at time zone 'Asia/Muscat'
  WHERE id='20000000-0000-4000-8000-000000000007' AND status='SCHEDULED';

  UPDATE public.appointments
  SET status='NO_SHOW', visit_stage=NULL,
      no_show_marked_at=((v_day-2) + time '14:30') at time zone 'Asia/Muscat',
      no_show_note='حالة تجريبية لعرض عدم الحضور'
  WHERE id='20000000-0000-4000-8000-000000000008' AND status='SCHEDULED';
END $$;
