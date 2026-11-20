GOLDEN TOUCH — BILINGUAL CUSTOMER WEBSITE

ফাইলসমূহ:
- index.html: বাংলা/English responsive customer storefront
- supabase-config.js: Golden Touch Supabase public URL ও anon key
- track-order.html: আগের order tracking page

Netlify deploy:
1. এই ZIP extract করুন।
2. Netlify > Add new site > Deploy manually-তে পুরো ফোল্ডার drag & drop করুন।
3. index.html root folder-এ থাকতে হবে।

গুরুত্বপূর্ণ:
- Product listing Supabase public.products টেবিল থেকে লোড হয়।
- Checkout public.place_order RPC ব্যবহার করে।
- Checkout কাজের জন্য Supabase-এ place_order function, RLS এবং product data ঠিক থাকতে হবে।
- bKash/Nagad এখানে Manual payment option; automatic gateway integration নয়।
- এই প্যাকেজে Admin Dashboard নেই, কারণ অনুরোধ অনুযায়ী এটি শুধু public website।
- Live deploy করার আগে test order দিয়ে যাচাই করুন; real order তৈরি হতে পারে।
