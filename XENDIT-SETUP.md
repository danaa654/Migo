# Xendit test-mode setup (MIGO subscriptions)

1. Log in to the Xendit dashboard and make sure the TEST MODE banner is on.
2. Settings > Developers > API Keys > Generate secret key. Give it WRITE access for Money-in (Invoices).
   Copy it (xnd_development_...). It is shown once.
3. Settings > Developers > Webhooks: copy the "Webhook verification token".
4. Same page: set the "Invoices paid" webhook URL to   https://<your public tunnel>/webhooks/xendit   and press Test and Save.
5. Add to C:\xampp\htdocs\Migo\.env (never commit it, never put it in React):

   PAYMENT_DRIVER=xendit
   XENDIT_SECRET_KEY=xnd_development_xxxxxxxx
   XENDIT_CALLBACK_TOKEN=xxxxxxxx
   APP_URL=https://<your public tunnel>

6. php artisan migrate        (skip if you already ran the gateway-columns migration)
   php artisan config:clear
7. Start your Cloudflare tunnel (Xendit must be able to reach /webhooks/xendit) and restart npm run dev.
8. Rider > Subscription > Subscribe > Pay. On Xendit's page pick a payment method, then use the
   "simulate payment" link shown in the test-mode banner. The rider page turns Active within seconds.
