# Human to-do

Things only the project's creator can do. They are in the order to do them. Nothing here has been done by the coding agents: no account was created, nothing was deployed, and no secret exists yet.

## A. Before anyone else sees the app

1. **Have a parent, teacher, or attorney review the Terms and the Privacy Policy** (`app/src/legal/content.ts`, shown in the app under More). They are good-faith drafts, not legal advice. Ask the reviewer about three things in particular:
   - the governing-law sentence ("These terms are governed by the laws of the State of California, USA.");
   - the age check: an "I am 13 or older" box sits next to an "I am under 13" button, which may nudge a child to tick the box. A neutral question is the usual pattern. Also decide whether "I am under 13" should have an undo; today only "Clear data on this device" reverses it;
   - the sentence about an unsubscribe link in alert emails, which describes a feature that is switched off.
2. **Bump the policy version.** The policy text changed on October 13, 2026. Set `POLICY_VERSION` and `POLICY_EFFECTIVE_DATE` to the review date in `shared/constants.ts` and `POLICY_VERSION` in `backend/settings.py`, together.
3. **Confirm the license.** `LICENSE` is MIT in your name because the Credits screen says so. Change both if you want a different license.
4. **Font licenses: checked, nothing to do unless you want to confirm.** On October 14, 2026 the license files of Inter (`LICENSE_FONT` in `@expo-google-fonts/inter`) and Fraunces (`OFL.txt` from Google Fonts) were read: neither declares a Reserved Font Name, so the cut-down copies in `app/public/fonts/` and `app/assets/fonts/` may keep their names. The license texts sit beside the files.
5. **Have native speakers review the Dari, Chinese and Vietnamese text**, and ideally the Spanish. `docs/I18N_REVIEW.md` says what to read first. Until then the language list in the app tells people the translations are unreviewed.
6. **Re-check every source.** Open each address in `docs/DATA_SOURCES.md`, confirm the app still matches it, and update the `retrieved` dates.

## B. Deploy (details in `deployment/deploy_guide.md`)

7. **Create the Supabase project.** Run `backend/database/schema.sql`, then `rls_policies.sql`, then `seed.sql` in the SQL editor. Confirm the private `report-photos` bucket exists.
8. **Generate two secrets** with `python -c "import secrets; print(secrets.token_urlsafe(48))"`: one for `ADMIN_TOKEN`, one for `OWNER_HASH_SALT`. Store them in a password manager. Never put them in the repository. The API refuses to start with an `ADMIN_TOKEN` shorter than 24 characters (this command makes 64). Set `OWNER_HASH_SALT` once and never change it: every resident's data is tied to it.
9. **Deploy the backend** (Railway reads `railway.toml`). Set:
   - `APP_ENV=production`. With Supabase configured, production is already the default, but set it explicitly: a development value (`local`, `dev`, `development`, `debug`, `test`) turns the public API docs back on, allows `*` in `CORS_ORIGINS`, and lets the API start without `OWNER_HASH_SALT`.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - `SUPABASE_JWT_SECRET`, from the project's JWT settings in Supabase, so admin Google sign-in works; without it every sign-in is rejected. If you use an asymmetric signing key instead of the legacy secret, also set `SUPABASE_JWT_ALGORITHM` (for example `ES256` or `RS256`); the default is `HS256`.
   - `ADMIN_TOKEN` and `OWNER_HASH_SALT` from step 8. In production Supabase mode the API refuses to start without `OWNER_HASH_SALT`.
   - `TRUST_PROXY=1`. This is correct behind exactly one proxy, such as Railway's (see S4).
   - Optionally `ANTHROPIC_API_KEY`.

   Open `/health` and confirm `"mode":"supabase"`, then confirm `/docs` returns 404.
10. **Deploy the frontend** (Vercel, Root Directory `app`). **Set `EXPO_PUBLIC_API_URL`** to the backend's address and redeploy. If that address is a custom domain rather than `*.up.railway.app`, add it to `connect-src` in the Content-Security-Policy in `app/vercel.json`, or the browser will block the app's API calls.
11. **Set `CORS_ORIGINS`** on the backend to the frontend's exact address. A `*` stops the API from starting in production.
12. **Run the smoke test** in `deployment/deploy_guide.md`, section 5, all ten steps, on a phone and a computer.
13. **Test `docker compose up --build` once.** The Docker files were written without Docker installed and have never been run.

## C. Before the repository is public

14. **Search the history for secrets**: `git log -p | grep -iE "service_role|sk-ant|ADMIN_TOKEN=."` should show nothing but empty templates.
15. **Decide whether `review/` goes public.** It lists bugs and security findings, most now fixed (`docs/SECURITY.md` has the status). Publishing it shows the process; it also lists the open items.
16. **Make the repo public:** https://github.com/RohinCodes15/ReSource. Until then, `PROJECT.repoUrl` in `shared/constants.ts` must not be shown on any screen. After, it can be added to the Credits screen.
17. **Merge `fix-round` into `main`** once you are happy with it.

## D. For the contest (details in `submission/`)

18. **Confirm the rules for your district.** `submission/RULES_CHECKLIST.md` lists what was found and what could not be confirmed. Your district's page and your Member of Congress's office are the authority.
19. **Record the demo video** following `submission/demo_script.md` and `submission/MEDIA_GUIDE.md`.
20. **Read every submission document aloud once.** They are written to be said in your own words; change anything that does not sound like you, and make sure you can answer every question in `submission/judge_qa.md` without notes.
21. **Submit before the deadline**, with the AI-assistance disclosure.

## E. Optional, later

22. **Android map:** create a Google Maps SDK for Android key restricted to the package `org.resource.fremont`, set it as `GOOGLE_MAPS_ANDROID_KEY` in EAS, and open the Map tab on a real device. Without the key an Android build shows the service list instead of the map.
23. **Sign-in:** needs a Supabase project and has never been run end to end. It is off until `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.
24. **Screen-reader pass:** go through the app once with VoiceOver or TalkBack (`docs/ACCESSIBILITY.md` lists what the automated checks cannot tell).
25. **Open security items** (details in `docs/SECURITY.md`):
   - S4: behind more than one proxy, the last `X-Forwarded-For` entry is the inner proxy's address, and there is no setting for more hops. No test covers the change.
   - S9: the scrubber still removes agency phone numbers and public addresses from posts; the allow-list the review suggested was not added.
   - S11: still one shared passcode. The audit log records what changed and when, not who, and it is a file in the local state folder, not the database, so it is lost if the host's disk is replaced.
   - S12: not run against a live Supabase project.
   - S13: no test runs the row-level security policies.
   - S14: the install token still lives in `localStorage`, so a script injection would still expose it. The CSP applies only when the site is hosted on Vercel.
   - S15: HSTS is still left to the host.
26. **Load time on slow phones** is the weakest measurement; `docs/ACCESSIBILITY.md` explains what would fix it.
