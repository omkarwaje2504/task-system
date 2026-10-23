# Task System

Projects, tasks and the design library for the studio team. Built with Next.js 16 (App Router), MongoDB and Cloudflare R2.

## Run it

```bash
bun install
bun dev            # http://localhost:3000
```

`.env` needs the same keys as error-tracking-api: `MONGODB_URI`, `JWT_SECRET`, `CREDENTIALS_SECRET`, `R2_*`.
Data goes in the `new-system` database (override with `MONGODB_DB`).

## Scripts

| Command | What it does |
| --- | --- |
| `node --env-file=.env scripts/import-from-error-tracking.mjs` | Copies users, companies, brands, product types, printers, credentials, every project of every type (reshaped into its type's steps, with tasks + daily counts) and the activity history from error-tracking-api's `task-tracker` DB. Discussions, links, client, sales/service person and attachments go into project notes. Read-only on the old DB, safe to re-run: existing records are never overwritten. |
| `node --env-file=.env scripts/create-admin.mjs "Name" email "password"` | Creates or resets an admin when nobody can log in. |
| `node --env-file=.env scripts/backup-and-reset.mjs [--clear]` | Saves every collection to `backups/<db>-<time>/` as Extended JSON. With `--clear`, then empties every collection except `users`. `--restore backups/<folder>` puts a backup back into empty collections. |

## How it's organised

- **Product types** (`productTypes`): each has an icon/color, a **Projects tab** switch (special types get their own tab; the rest are grouped under "Others"), an **Asset tab** switch (adds a design library under Assets, with configurable image slots like Cover / Front / Back), and a **step template**.
- **Projects** copy their product type's template into their own `steps` when created, so editing a template never breaks running projects. Step kinds:
  - `check`: simple done/not-done
  - `link`: needs a link (e.g. the client link)
  - `languages`: male & female video per language, each with text setting and audio. It completes itself when everything is ticked. With no languages selected, the step defaults to English.
  - `quantity`: RxPad-style daily added/completed/declined counts (`progress` collection)
  - `printer`: pick a printer from Printer Types
- **Company / brand** are typed freely and matched on a normalized key (`"Dr. Reddy's"` = `"dr reddys"`), so autosuggest + server-side matching avoid duplicates.
- **Steps are the tasks**: a project's steps come from its type's template, and people add more one by one (people, due date, details). "My steps" lists what's assigned to you; "I'm doing" marks a project's latest open step as in progress. Old tasks were merged in by `scripts/merge-tasks-into-steps.mjs`.
- **Auth**: JWT in an httpOnly `ns_token` cookie. Only admins create accounts. Every API call re-checks that the user is still active and what their role is.
- **Credentials** use the same AES-256-GCM scheme and secret as error-tracking-api. Passwords are decrypted on the server and shown to signed-in users straight in the list (click to copy).
- **Media tools** run fully in the browser (Mediabunny, pdf-lib, pdf.js).

Pages live in `app/(app)/*` (client components using SWR), and APIs in `app/api/*`. Shared workflow logic is in `lib/workflow.ts`.
