# Golden Touch Store

A fresh React + Vite storefront and Seller Central-style admin dashboard connected to the existing Supabase project.

## Included
- Public storefront with product search and cart
- Guest checkout using Supabase anonymous authentication
- Optional customer email/password account
- Guest session can be upgraded to an email/password account without changing its auth user ID
- Customer order history for the current signed-in/guest session
- Admin-only Seller Central area (email allowlist + database RLS)
- Product listing, new product creation, order status updates, bookings/services views
- Mobile responsive layout

## Setup
1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_ANON_KEY` to your Supabase **publishable key** (safe for browser use; never use a service-role key).
4. In Supabase Dashboard > Authentication > Sign In / Providers (or Auth > Settings), enable **Allow anonymous sign-ins**.
5. Ensure Email provider is enabled if customers should create email/password accounts.
6. Run:
   ```bash
   npm install
   npm run dev
   ```
7. Build for deployment:
   ```bash
   npm run build
   ```
   Deploy the `dist` folder to your hosting provider and configure SPA fallback to `index.html`.

## Existing project assumptions
- Supabase URL: `https://loyzzvrflfhndfnnppgf.supabase.co`
- Admin email allowlist: `ponni171196@gmail.com`
- Uses existing `public.products`, `public.orders`, `public.services`, `public.bookings`, and `public.store_settings_legacy` tables.
- Existing order table uses `user_id DEFAULT auth.uid()`. Guest checkout signs in anonymously first so this value is populated.
- Orders RLS allows authenticated users to create/read their own orders and the allowlisted admin to manage orders.

## Important security notes
- The publishable/anon key belongs in the frontend; a Supabase service-role key must NEVER be placed in `.env` or frontend code.
- Guest checkout is protected by an anonymous auth session, not an unauthenticated public INSERT.
- The admin UI checks the signed-in email for user experience; database RLS remains the actual security boundary.
- Do not remove or weaken the existing RLS policies.
- Order totals and product prices are currently submitted by the browser. Before accepting online payments or relying on order totals for accounting, move checkout pricing/stock validation into a trusted Supabase Edge Function.
- Admin email is a configurable allowlist in `.env`; keep it aligned with the email used by the database admin RLS policies.
- Account upgrade from guest uses Supabase `updateUser({email,password})`. If email confirmation is enabled, the customer must confirm their email.

## Current limitations
- This is a newly generated starter application, not a modification of your previous deployed website.
- Configure the Supabase anonymous sign-in toggle before guest checkout will work.
- Store settings editor, service CRUD, image upload, coupon system, shipping integrations, and payment gateway integrations are not included yet.
