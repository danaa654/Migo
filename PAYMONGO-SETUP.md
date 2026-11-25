# PayMongo test-mode setup (MIGO subscriptions)

1. Create a PayMongo account and stay in TEST mode. Dashboard > Developers > API keys: copy the secret key (sk_test_...).
2. Add to C:\xampp\htdocs\Migo\.env (never commit this file, never put the key in React):

   PAYMONGO_SECRET_KEY=sk_test_xxxxxxxx
   PAYMONGO_WEBHOOK_SECRET=whsec_xxxxxxxx
   PAYMONGO_PAYMENT_METHODS=gcash,paymaya,card,qrph
   APP_URL=https://<your public tunnel url>

   (Only keep the methods that are enabled in PayMongo > Settings > Payment Methods.)
3. Your app must be reachable from the internet for the webhook. Use the Cloudflare tunnel you already use and set APP_URL to it.
4. Dashboard > Developers > Webhooks > Add endpoint:
   URL    https://<your public tunnel url>/webhooks/paymongo
   Event  checkout_session.payment.paid
   Copy the signing secret it shows into PAYMONGO_WEBHOOK_SECRET.
5. php artisan migrate   (adds the gateway columns)
   php artisan config:clear
6. Test: rider > Subscription > Subscribe > Pay. On PayMongo's page use a test card from their testing docs
   (e.g. 4343434343434345, any future expiry, any CVC) or choose GCash and press Authorize on the test page.
   Within seconds the rider page flips to Active and the admin Payments tab shows "paid".
