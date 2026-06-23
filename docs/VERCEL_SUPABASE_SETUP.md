# Vercel ↔ Supabase Environment Variables

## المتغيرات المطلوبة في Vercel Dashboard

اذهب إلى: **Vercel → Project → Settings → Environment Variables**

| اسم المتغير | القيمة |
|---|---|
| `VITE_DATA_BACKEND` | `supabase` |
| `VITE_SUPABASE_URL` | `https://ktmizdznbdwvalmmfvfc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_YNpS0CW0IFIant4FOby1dA_w-REjZFr` |
| `VITE_CENTER_ID` | `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d` |
| `VITE_BRANCH_MODE` | `single` |

## ⚠️ تنبيهات

1. المفتاح الحرج هو `VITE_SUPABASE_PUBLISHABLE_KEY` (وليس ANON_KEY)
2. جميع المتغيرات تبدأ بـ `VITE_` حتى يقرأها Vite وقت البناء
3. بعد الإضافة في Vercel → اضغط **Redeploy**
