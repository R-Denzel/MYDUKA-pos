# MyDuka POS

## Premium features and Firebase setup

Daily POS work—including inventory, barcode scanning, checkout, and on-screen
reports—does not require sign-in. Accounts are optional unless an owner wants
Premium features; those require a signed-in account with an active Premium
entitlement.

For local UI and checkout testing, run `npm run dev` on localhost and choose
**Start local Premium demo** in Owner settings. The demo unlocks Premium-only
client features without using dummy credentials; product and sale changes
made while demo mode is active stay on the device and are not written to
Firebase. It is not available in production builds. Push notifications and
the administrator dashboard still require real authorized accounts.

The web app needs its existing Firebase environment values in Vercel. Set
`VITE_FIREBASE_VAPID_KEY` there as well to enable browser push notifications.
Get the Web Push certificate key from Firebase Console → Project settings →
Cloud Messaging. Never put service-account keys in Vercel's `VITE_` variables
or commit them to the repository.

1. Enable Email/Password sign-in in Firebase Authentication. Users can create
   an account from Owner settings when they want Premium features.
2. Add a Firestore rule for notification tokens:
   `match /users/{uid}/devices/{token} { allow read, write: if request.auth != null && request.auth.uid == uid; }`
   Preserve the rules already protecting product and sale data.
3. Use a Firebase project on the Blaze plan, install Firebase CLI, and select
   the project with `firebase use --add`.
4. Copy `functions/.env.example` to `functions/.env.<project-id>` and set
   `PREMIUM_ADMIN_EMAILS` to a comma-separated allowlist of administrator
   email addresses. Keep that file private.
5. Deploy the notification, administrator access, and Premium entitlement functions with
   `firebase deploy --only functions`.
6. Sign in to DukaPOS, then choose **Enable sale alerts** on every device that
   should receive owner notifications. Sales completed while signed in include
   the owner account id so the server can send the push notification.
7. Verified emails in `PREMIUM_ADMIN_EMAILS` can open the Admin dashboard from
   Owner settings. It lists Firebase Authentication accounts and lets admins
   grant or revoke Premium. The callable functions enforce this allowlist on
   the server; access to the dashboard is not based on a client-side role flag.
   After granting Premium to another account, that account should sign out and
   back in to refresh its custom claims.

VAT and discounts are off unless configured/applied. VAT jurisdiction (Uganda,
Kenya, or custom), percentage, and inclusive/exclusive treatment are
configurable in Owner settings. Package
options (such as carton, pack, or bottle) each use their own price and stock.
Report downloads are PDF; Code 128 barcode labels use the browser print dialog.
