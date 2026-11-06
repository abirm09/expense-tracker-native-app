# Expense Tracker

Multi-user Expo/React Native expense tracker backed by Supabase. Every signed-in
account owns a fully isolated set of accounts, categories, transactions, budgets,
contacts and its own 5-digit PIN.

## Database setup

Run these files in the Supabase SQL Editor in order:

1. `supabase/schema.sql` — base tables, RLS and RPCs.
2. `supabase/multiuser_migration.sql` — per-user defaults, tighter RLS and
   multi-account safety (recommended for every existing project).

The app's login screen supports **Sign In**, **Create Account**, and **Forgot password**. Each new account is seeded with its own default accounts and categories by the database trigger.

## Authentication setup (required)

In **Supabase Dashboard → Authentication**:

1. **Providers → Email**: enable Email. Decide whether **Confirm email** is on.
2. **URL Configuration**:
   - **Site URL**: your production web URL, or `http://localhost:8081` for local web.
     This is Supabase's **fallback** redirect. If it is left at the default
     `http://localhost:3000`, every auth email whose redirect is not
     allow-listed will point there instead of at the app.
   - **Redirect URLs** — add all of these:
     - `expensetracker://**` (production/development builds)
     - `exp://**` (Expo Go)
     - `http://localhost:8081/auth/callback` (web)

The app builds its redirect from `Linking.createURL('auth/callback')` (see `src/lib/auth-redirect.ts`), so changing the `scheme` in `app.json` also requires updating the allow-list above. In development, the app logs the exact URL it sends to Supabase (`[auth] password reset redirectTo: ...`).

**What the flow does**

- Confirmation, recovery and magic-link emails open the app directly.
- The deep link is exchanged for a session (`?code=` for PKCE, `?token_hash=`, or `#access_token=`), so a confirmed user lands inside the app already signed in.
- Password reset opens a dedicated **Set a New Password** screen; no password is ever sent by email.
- If a confirmation email never arrives, the sign-in screen offers **Resend confirmation email**.

### Password reset troubleshooting

- **The email links to `localhost:3000`** — the redirect sent by the app is not
  in **Redirect URLs**, so Supabase replaced it with the **Site URL**. Add the
  URL printed in the dev console (or the wildcards above) and update the Site URL.
- **The link opens but the app shows no reset screen** — make sure the link was
  opened on the **same device** that requested the reset. The PKCE code verifier
  is stored on that device, so a link opened on another phone or computer cannot
  complete the exchange.
- **The email template was customized** — keep the button pointing at
  `{{ .ConfirmationURL }}`. If it uses `{{ .SiteURL }}` instead, Supabase ignores
  the app's redirect and always uses the Site URL.

> Supabase's built-in email service is rate-limited to a few messages per hour. Configure **custom SMTP** before production use.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
