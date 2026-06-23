# Vercel ↔ Supabase Environment Variables

## المتغيرات المطلوبة في Vercel Dashboard

اذهب إلى: **Vercel → Project → Settings → Environment Variables**

| اسم المتغير | القيمة | المصدر |
|---|---|---|
| `VITE_DATA_BACKEND` | `supabase` | ثابت |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...` | Supabase → Project Settings → API → anon/public key |
| `VITE_CENTER_ID` | UUID للمركز | من جدول `centers` في Supabase |
| `VITE_BRANCH_MODE` | `single` | ثابت للفرع الواحد |

## ⚠️ تنبيهات مهمة

1. **اسم المتغير الدقيق**: `VITE_SUPABASE_PUBLISHABLE_KEY` (وليس `VITE_SUPABASE_ANON_KEY`)
   — هذا ما يقرأه `src/infrastructure/supabase/env.ts`
2. جميع المتغيرات يجب أن تبدأ بـ `VITE_` حتى يتعرف عليها Vite في وقت البناء.
3. بعد تعديل المتغيرات في Vercel، اضغط **Redeploy** من لوحة التحكم.
4. لا تضع القيم داخل `.env` في الكود — فقط في `.env.example` (بدون قيم حقيقية).

## التحقق السريع

بعد النشر، افتح Developer Tools → Console وتحقق من:
```
VITE_DATA_BACKEND = supabase ✓
VITE_SUPABASE_URL starts with https:// ✓
VITE_CENTER_ID is a valid UUID ✓
```
