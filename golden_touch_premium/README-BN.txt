GOLDEN TOUCH FULL MANAGEMENT SYSTEM
====================================
এই প্যাকেজে:
- admin.html: Dashboard, Products CRUD, product image upload, Categories CRUD,
  Orders edit/status/delete, Parlour Bookings edit/status/delete, Services CRUD,
  Customer directory, sales reports, store settings.
- index.html: existing storefront (existing file retained)
- supabase-config.js: existing project URL/public anon key (retained)
- setup.sql: full database tables, RLS policies, grants and product image storage bucket.

INSTALL STEPS
1) Supabase project loyzzvrflfhndfnnppgf > SQL Editor > New query.
2) setup.sql সম্পূর্ণ কপি করে Run করুন। Script existing products/orders/bookings delete করে না।
3) Netlify project > Deploys > deploy manually. ZIP extract করে golden_touch_premium folder-এর ভেতরের সব file একসঙ্গে deploy করুন.
4) Admin: https://goldentouchbeautysolution.netlify.app/admin.html
5) Sign in with Supabase Auth admin user ponni171196@gmail.com and your existing password.

IMPORTANT
- আপনার Supabase Auth-এ admin user আগে থেকে থাকতে হবে।
- supabase-config.js-এ থাকা public anon key কেবল browser-এ ব্যবহারের জন্য। service_role/secret key কখনো deploy করবেন না।
- Image upload-এর জন্য setup.sql storage bucket ও policies তৈরি করে।
- Services/Categories/Settings management database-এ কাজ করবে। Storefront booking form-কে services table থেকে dynamic service list দেখাতে আলাদা frontend integration প্রয়োজন হতে পারে।
- Orders/Bookings delete permanent; delete করার আগে confirm prompt আসে।
- এই ZIP তৈরি হয়েছে; Supabase SQL run বা Netlify deploy স্বয়ংক্রিয়ভাবে হয়নি। Deploy শেষে প্রতিটি tab live পরীক্ষা করুন।
