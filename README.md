# Athlete OS — deployment guide

**What's new in this version:** the app is no longer hardcoded to one player. You pick a playing role
(batsman, fast bowler, spinner, wicketkeeper, all-rounder) in the Nutrition tab's profile section, and:
- The **Cricket tab** shows different metric fields depending on your role (shot execution % for batsmen,
  overs/effort balls/control % for bowlers, catches/stumpings/footwork for keepers).
- The **Workout tab** now pulls your weekly S&C split from your own editable database rows instead of a
  fixed program — tap "edit day" on any day to change exercises, targets, or session type. A sensible
  default is seeded automatically the first time you log in.
- A **mindset gatekeeper**: if a cricket entry (logged manually or via AI Log) shows high fatigue, low
  execution/control, or frustrated language, the app pauses before saving and offers a 7-minute breathing
  reset first, rather than going straight into technical self-review.

Copy-paste your way through this, in order. Total time: ~20-30 minutes.

## 1. Create your database (Supabase)

1. Go to supabase.com → sign up → **New project**. Pick any name/region, set a database password (save it somewhere).
2. Once it's created, go to the **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase.sql` from this project, copy the whole file, paste it in, click **Run**.
4. Then do the same with `supabase-v2.sql` (adds programs, match scorecards, niggle tracking, sleep/RPE columns). If you already had v1 running, just run `supabase-v2.sql` on its own — it is safe on an existing database.
5. Then run `supabase-v3.sql` the same way — adds the onboarding fitness-assessment fields and the help-tour flag. Required for this version of the code to work; the app will error on sign-up/onboarding without it.
6. Then run `supabase-v4.sql` — adds profile bio/avatar/socials, friends, the activity feed, photo attachments, and push notification storage. Also required for this version.

## Push notification reminders (optional but free)

1. In the project folder, run `npm install` then `npx web-push generate-vapid-keys`. Copy the two keys it prints.
2. Add three env vars in Vercel (Project Settings → Environment Variables): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from step 1), and `CRON_SECRET` (any long random string you make up yourself).
3. That's it — `vercel.json` already schedules a daily check at 15:00 UTC (20:30 IST) that nudges anyone who hasn't logged anything that day. Vercel's free Hobby tier supports one cron job a day at no cost.
4. Each player turns reminders on individually from their Profile tab — it's opt-in per person, not automatic.
4. Go to **Project Settings → API**. You'll need three values from this page in step 3 below:
   - `Project URL`
   - `anon public` key
   - `service_role` key (click "reveal") — keep this one secret, never share it

## 2. Get your Groq API key (free, no credit card)

1. Go to console.groq.com → sign in with any email or Google account.
2. Go to **API Keys** → **Create API key**.
3. Copy it. This is what powers the "AI Log" voice/text parsing feature, on Groq's free tier — no payment method required, and it's very fast. The free tier (~30 requests/min, ~1,000/day) comfortably covers a handful of log entries a day.

## 3. Put the project on GitHub

Open a terminal in this project folder and run, one line at a time:

```
git init
git add .
git commit -m "Athlete OS initial commit"
```

Then go to github.com → **New repository** → name it `athlete-os` → **don't** check "add a README" → **Create repository**. GitHub will show you two commands like this — copy them exactly from your own repo page and run them:

```
git remote add origin https://github.com/YOUR-USERNAME/athlete-os.git
git branch -M main
git push -u origin main
```

## 4. Deploy on Vercel

1. Go to vercel.com → sign up **with your GitHub account** (this lets Vercel see your repo).
2. **Add New → Project** → pick your `athlete-os` repo → **Import**.
3. Before clicking Deploy, open **Environment Variables** and add these four (names must match exactly):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 1 |
   | `GROQ_API_KEY` | the key from step 2 |

4. Click **Deploy**. In about a minute you'll get a live URL like `athlete-os-yourname.vercel.app`.

## 5. Create your account and install it on your phone

1. Open the Vercel URL → **Sign up** with your own email/password (this is your personal login, stored securely in Supabase — nobody else can see your data, enforced by the database rules in `supabase.sql`).
2. On your phone, open the same URL in Chrome/Safari → tap the browser menu → **Add to Home Screen**. It now behaves like an installed app with its own icon, no App Store needed.
3. Same login works on your laptop — same data, always in sync, since it all lives in Supabase rather than on either device.

## Testing with a group (e.g. 10 friends)

Supabase's free-tier database itself has no "5 users" limit. What actually blocks signups past the first few is the **built-in email sender**, which only sends 2 emails/hour project-wide and only to addresses on your own Supabase team — everyone else's confirmation email silently fails.

**For a closed beta with people you know:** Supabase Dashboard → **Authentication → Providers → Email** → turn **off "Confirm email."** Testers can sign up and get straight in, no email step at all.

**Before opening this to strangers:** turn "Confirm email" back on and set up free custom SMTP instead, under **Authentication → Emails → SMTP Settings** — Resend's free tier (3,000 emails/month) is a good option and takes about 15 minutes to wire up.

## Updating the app later

Whenever you want to change something: edit the files, then run:
```
git add .
git commit -m "describe what changed"
git push
```
Vercel automatically redeploys within about a minute of every push. No manual redeploy step.

## Costs

- Vercel free tier: plenty for one user.
- Supabase free tier: plenty for one user (500MB database, 50k monthly active users).
- Groq free tier: no credit card, no payment ever required at this usage level (a few log entries a day, well under the ~1,000 requests/day free cap). If a request ever gets rejected for hitting a rate limit, just wait a few seconds and try again.

## What's already secured

- Passwords are hashed and managed by Supabase Auth — never touched or stored by this app's own code.
- The Groq API key lives only in Vercel's server environment and is never sent to the browser.
- Every database table has Row Level Security — even if someone got your anon key, they could only ever read or write their *own* rows, never another user's.
- The `/api/ai-log` route checks you're logged in before it will process any request, so a stranger can't run up usage against your free quota.
