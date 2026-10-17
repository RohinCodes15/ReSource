# Admin screen: manual browser test

Branch `admin-google-signin`. Each step lists what you should see; anything else is a failure.

## Before you start

1. `backend/.env`: set `ADMIN_TOKEN` to a passcode of your choice (it is empty now, and with it
   empty every passcode is refused). Restart the API after changing it.
2. Supabase → Authentication → Sign In / Providers → Google: enabled, Client ID and secret saved.
   Redirect URLs include `http://localhost:8081/sign-in`.
3. Have two Google accounts: one to make an admin, one to stay a normal user.
4. File at least two reports first (section 6), one with a photo, so the lists are not empty.

Start the servers in two terminals:

```sh
# Terminal 1: API on http://localhost:8000
cd backend
.venv/bin/uvicorn main:app --reload --port 8000

# Terminal 2: web app on http://localhost:8081
cd app
npm run web
```

Check: `curl http://localhost:8000/config` shows `"mode":"supabase"` and `"auth_enabled":true`.

## 1. Google sign-in as an admin

| Step | Expected |
|---|---|
| Open http://localhost:8081/sign-in, tick the consent box, press **Continue with Google**, pick the admin account | Google's account picker, then back on `/sign-in` showing "Signed in as …" |
| First time only: run the SQL in `ADMIN_PR_DESCRIPTION.md` for this email | The SQL editor says **1 row** updated (0 means the email does not match) |
| Sign out, then sign in with Google again | "Signed in as …" and an **Open admin tools** button |
| Press **Open admin tools** | Admin screen with a green "Signed in as … with an admin account" banner, no passcode form, Reports tab open |

## 2. Reports tab

| Step | Expected |
|---|---|
| Filter **Waiting** | Pending reports, each with **Verify** and **Reject** |
| Press **View the photo** on a report that has one | The photo loads in the card. A report without one has no button |
| Press **Verify** on a report | "Saved." notice; the report leaves the Waiting list |
| Filter **Verified** | That report is here, with **Reject** and **Move back to waiting**, no Verify |
| Press **Reject** | A sheet asks "Reject this report?". **Cancel** closes it and nothing changes |
| Press **Reject** again, then **Reject** in the sheet | "Saved."; the report moves to the **Rejected** filter |
| Filter **Rejected**, press **Move back to waiting**, confirm | A sheet asks first; after confirming, the report is back under **Waiting** |
| Pick a filter with no reports | A "No … reports" message, not an error |

## 3. Signed in, not an admin

| Step | Expected |
|---|---|
| Sign out, sign in with Google as the second (non-admin) account | "Signed in as …" with **no** Open admin tools button |
| Go to http://localhost:8081/admin directly | "Staff only" card, a notice that this account is not an admin, and the passcode form. No tabs or reports |
| Enter the `ADMIN_TOKEN` passcode, press **Unlock** | Tools open with the "unlocked on this device" banner and a **Lock** button |
| Press **Lock** | Back to the locked card |
| Optional, proves the API is the gate: in DevTools → Network, copy a `/admin/reports` request "as cURL" while unlocked, remove the `X-Admin-Token` header, run it | `403` with `admin_required` |

## 4. Passcode only, no Google sign-in

| Step | Expected |
|---|---|
| Sign out (or use a private window), open http://localhost:8081/admin | "Staff only" card with the passcode form and no "not an admin" notice |
| Enter a wrong passcode | "That passcode is not correct." |
| Enter the right passcode | Tools open; Reports filters and actions work as in section 2 |

## 5. Language

| Step | Expected |
|---|---|
| Switch the language (Settings) to Español, فارسی, Tiếng Việt and 中文, open Admin | Filters, buttons, the confirmation sheet and the notices are translated; no raw keys like `admin.filter_pending` |

## 6. Reporting still works without an account

| Step | Expected |
|---|---|
| Signed out, open http://localhost:8081/report and file a report (add a photo once) | A receipt is shown. No sign-in is asked for |
| As an admin, filter **Waiting** | The new report is listed, and the photo opens for the one that has it |
