GOLDEN TOUCH — WEBSITE PROJECT (React + Vite + Supabase)

এই প্যাকেজে মূল ওয়েবসাইটের React/Vite source, GitHub Pages workflow, logo এবং Admin CSV Reports পেজ একত্র করা হয়েছে।

প্রকাশের আগে GitHub repository-তে একই path অনুযায়ী ফাইলগুলো upload/replace করুন:
- .github/workflows/static.yml
- golden-touch 2/index.html
- golden-touch 2/package.json
- golden-touch 2/vite.config.js
- golden-touch 2/src/App.jsx
- golden-touch 2/src/main.jsx
- golden-touch 2/src/style.css
- golden-touch 2/src/supabase.js
- golden-touch 2/public/golden-touch-logo.jpeg
- golden-touch 2/public/admin-reports.html
- golden-touch 2/public/admin-reports.js

গুরুত্বপূর্ণ:
1) GitHub Actions > Settings > Secrets and variables > Actions > Variables-এ এই variables রাখুন:
   VITE_SUPABASE_URL = https://loyzzvrflfhndfnnppgf.supabase.co
   VITE_SUPABASE_ANON_KEY = আপনার Supabase publishable/anon key
   VITE_ADMIN_EMAIL = ponni171196@gmail.com
   Secret key/service_role key কখনো frontend বা GitHub Variables-এ দেবেন না। Publishable/anon key-ই ব্যবহার করুন।
2) GitHub Pages workflow main branch-এ push হলে build/deploy করবে।
3) Supabase Auth-এ Anonymous Sign-ins চালু থাকতে হবে, কারণ guest checkout এটি ব্যবহার করে।
4) bKash/Nagad বর্তমানে manual reference/transaction ID-ভিত্তিক payment option; automatic payment gateway integration নয়। COD-ও আছে।
5) Admin CSV Reports: https://ponnihan.github.io/Golden-Touch-Beauty-Solution/admin-reports.html
   Admin-এ sign-in করে একই browser session-এ রিপোর্ট পেজ খুলুন।
6) পার্লারের ঠিকানা Bankra, Jhingergacha, Jashore এবং Plus Code X3HC+3C ধরে Google Maps search link যুক্ত হয়েছে। প্রকাশের আগে ঠিকানাটি যাচাই করুন।
7) Product photos এবং inventory বাস্তব তথ্য দিয়ে Supabase Admin থেকে আপডেট করুন। ডেমো/নমুনা product-কে বাস্তব stock ধরে নেবেন না।
8) এই ZIP তৈরি করা হয়েছে; আপনার GitHub repository-তে স্বয়ংক্রিয়ভাবে push করা হয়নি। GitHub-এ ফাইল replace/commit করার পরই live site আপডেট হবে।

মূল ফিচার:
- Responsive storefront, category browse, search, cart
- Guest checkout এবং optional account
- Order tracking এবং account order history
- Seller Central: orders, product add/hide, stock/product management
- COD, bKash manual, Nagad manual
- CSV report page
- WhatsApp/contact support এবং parlour map directions
- AI skin scanner এখনো যুক্ত করা হয়নি

নিরাপত্তা: Supabase service_role/secret key কখনো browser code-এ রাখবেন না।
