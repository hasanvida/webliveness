# Tutorial: Deploy VIDA Web SDK Tester on Netlify with Secrets in Env Vars

This tutorial walks you through deploying the VIDA Web SDK tester to Netlify, with `client_id`, `client_secret`, and `signing_key` stored as **Netlify environment variables** instead of being pasted into the page. The tester will fetch a fresh Bearer Token from a Netlify Function each time, so you never expose secrets in the HTML or git history.

## How this is different from the old tester

| | Old tester | New tester |
|---|---|---|
| Bearer Token | Paste manually each time | Auto-minted by Netlify Function |
| Signing Key | Paste manually each time | Served by Netlify Function |
| Client ID / Secret | Not used in browser | Stored in Netlify env vars (server-side only) |
| User must do | Paste 3 secrets every session | Just type User ID and click Start |

The token is short-lived (5h sandbox / 5min production per VIDA docs), so this also means tokens are always fresh — no more "token expired" surprises mid-test.

---

## Architecture at a Glance

```
┌────────────────────┐         ┌────────────────────────┐         ┌──────────────────┐
│  Browser (you)     │         │  Netlify Function       │         │  VIDA SSO        │
│  index.html        │ ─GET──▶ │  /api/vida-token        │ ─POST─▶ │  qa-sso.vida.id  │
│                    │         │  reads env vars         │         │  /token endpoint │
│                    │ ◀─JSON──│  returns {token,        │ ◀─JWT── │                  │
│  Initialize SDK    │         │   signingKey}           │         │                  │
│  with token        │         │                         │         │                  │
└────────────────────┘         └────────────────────────┘         └──────────────────┘
                                          ▲
                                          │ reads at runtime
                                          ▼
                               ┌────────────────────────┐
                               │  Netlify env vars       │
                               │  VIDA_CLIENT_ID_*       │
                               │  VIDA_CLIENT_SECRET_*   │
                               │  VIDA_SIGNING_KEY_*     │
                               └────────────────────────┘
```

**What's secret-protected:** `client_id`, `client_secret` — never leave the function, never appear in browser or git.

**What's still in the browser:** `token` (already designed to be short-lived) and `signingKey` (same trust level as token — see *Honest Security Note* at the end).

---

## What You'll Need Before Starting

- A **GitHub account** (free): https://github.com
- A **Netlify account** (free tier is fine): https://netlify.com
- Your VIDA sandbox credentials: `client_id`, `client_secret`, `signing_key`
  - These come from VIDA Solution Engineering during partner onboarding
  - For sandbox testing they're labeled `..._SANDBOX`; for production `..._PRODUCTION`

---

## Step 1 — Get the Code into a GitHub Repo

### Option A: Upload via GitHub web UI (no terminal needed)

1. Go to https://github.com/new
2. Repo name: `vida-sdk-tester` (or anything you want)
3. Set it to **Private** (recommended — even though no secrets are in the code, less attack surface)
4. Check "Add a README file" → click **Create repository**
5. On the repo page, click **Add file → Upload files**
6. Drag and drop these files/folders from the zip you got:
   - `index.html`
   - `netlify.toml`
   - `.gitignore`
   - `README.md`
   - The `netlify/` folder (it contains `functions/vida-token.js`)
7. Scroll down → **Commit changes**

### Option B: Clone & push via git (terminal)

```bash
# Clone an empty repo you created on GitHub
git clone https://github.com/YOUR_USERNAME/vida-sdk-tester.git
cd vida-sdk-tester

# Copy in the files from the zip
cp -r /path/to/extracted/zip/* .

# Commit and push
git add .
git commit -m "Initial commit — VIDA Web SDK tester with Netlify function"
git push origin main
```

**Verify in GitHub:** you should see `index.html`, `netlify.toml`, `netlify/functions/vida-token.js`, and the other files in your repo.

---

## Step 2 — Connect the Repo to Netlify

1. Go to https://app.netlify.com → log in (or sign up with your GitHub account)
2. On the dashboard, click **Add new site → Import an existing project**
3. Choose **Deploy with GitHub** → authorize Netlify to access your GitHub
4. Pick the `vida-sdk-tester` repo
5. On the build settings page:
   - **Branch to deploy:** `main`
   - **Build command:** *leave blank* (no build step needed)
   - **Publish directory:** `.` (already set by `netlify.toml`)
6. Click **Deploy site**

Netlify will deploy in ~10 seconds and give you a URL like `https://splendid-cupcake-123abc.netlify.app`. Open it — you'll see the tester load, but trying to start the SDK will fail with "Missing env vars" because we haven't set them yet. That's expected.

---

## Step 3 — Set Environment Variables in Netlify

This is where the secrets live.

1. In Netlify, go to your site → **Site configuration → Environment variables**
2. Click **Add a variable → Add a single variable** for each of these:

   ### Required for Sandbox
   | Key | Value |
   |---|---|
   | `VIDA_CLIENT_ID_SANDBOX` | (your sandbox `client_id` from VIDA) |
   | `VIDA_CLIENT_SECRET_SANDBOX` | (your sandbox `client_secret` from VIDA) |
   | `VIDA_SIGNING_KEY_SANDBOX` | (your sandbox `signing_key` from VIDA) |

   ### Optional for Production (only if you'll test prod)
   | Key | Value |
   |---|---|
   | `VIDA_CLIENT_ID_PRODUCTION` | (your prod `client_id`) |
   | `VIDA_CLIENT_SECRET_PRODUCTION` | (your prod `client_secret`) |
   | `VIDA_SIGNING_KEY_PRODUCTION` | (your prod `signing_key`) |

3. For each variable, set scope to **All scopes** (Functions + Runtime) or at minimum **Functions** since only the function reads them.
4. Click **Save**

5. Trigger a redeploy so the function picks up the new env vars:
   - **Deploys → Trigger deploy → Deploy site**

---

## Step 4 — Test the Tester

1. Open your Netlify URL (something like `https://splendid-cupcake-123abc.netlify.app`)
2. Type any value into **User ID** (e.g., `hasan-test-001`)
3. Leave **SDK Version** as `1.1.1`, **Environment** as `Sandbox`
4. Click **Start Liveness Detection**
5. The page status should walk through:
   - `Fetching credentials from Netlify Function...`
   - `Loading SDK script...`
   - `SDK loaded. Initializing...`
   - `SDK running — follow the on-screen instructions.`
6. Allow camera permission → go through the liveness flow → result JSON appears in the right panel

**If you see a 500 error in the status:** open browser DevTools → Network tab → click the failed `vida-token` request → look at the response. Most likely: env vars missing or typo'd. Go back to Step 3.

---

## Step 5 — Test Locally (Optional)

If you want to develop and test the function locally before pushing:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# In your repo folder
netlify login

# Create a local .env file (NEVER commit this — already in .gitignore)
cat > .env <<EOF
VIDA_CLIENT_ID_SANDBOX=your-sandbox-client-id
VIDA_CLIENT_SECRET_SANDBOX=your-sandbox-client-secret
VIDA_SIGNING_KEY_SANDBOX=your-sandbox-signing-key
EOF

# Run locally with functions emulated
netlify dev

# Opens http://localhost:8888 — functions work as if deployed
```

---

## Step 6 — Custom Domain (Optional)

The `splendid-cupcake-123abc.netlify.app` URL works but isn't memorable. To use a custom domain:

1. In Netlify → **Domain management → Add a custom domain**
2. Enter `vida-tester.example.com` (or whatever subdomain you want)
3. Either:
   - **Use Netlify DNS** — point your domain nameservers to Netlify
   - **Use your existing DNS** — add a CNAME record to your DNS provider:
     - Name: `vida-tester`
     - Value: `splendid-cupcake-123abc.netlify.app`
4. Netlify will auto-provision an HTTPS cert via Let's Encrypt (takes a few minutes)

---

## Troubleshooting

### "Function returned 500: Missing env vars..."
You haven't set the env vars yet, or they're typo'd. Check Step 3. Names are case-sensitive.

### "VIDA OAuth 401: invalid_client"
Your `client_id` or `client_secret` is wrong. Double-check what VIDA gave you.

### "VIDA OAuth 404"
The SSO URL might be wrong. Sandbox should hit `qa-sso.vida.id`. If you're testing production, make sure `VIDA_CLIENT_ID_PRODUCTION` etc. are set and the environment dropdown is set to Production.

### "Function returned 502: No access_token in VIDA response"
VIDA returned something unexpected. Check Netlify function logs → **Functions tab → vida-token → recent invocations** to see the raw response.

### "window.VidaSDK not found"
The SDK script didn't load. Check your `SDK Version` value — should match a real published version (default `1.1.1`).

---

## Honest Security Note

This setup keeps `client_id` and `client_secret` **strictly server-side** — they never reach the browser. That's the primary win.

But `token` and `signingKey` are both **delivered to the browser** because `VidaSDK.init()` runs client-side and needs them. If someone opens browser DevTools while the tester is running, they can read both values from network responses or memory. They'd be limited by the token's expiry (5 hours sandbox / 5 minutes production), and they can't reuse the `client_credentials` flow themselves without your `client_secret`.

**This is the same security level as if VIDA gave you a token directly and you pasted it.** The improvement here is operational, not cryptographic: you avoid the hassle of generating + pasting tokens manually, and your `client_id` / `client_secret` stay out of git history.

For stronger isolation (full signing key never in browser), you'd need a deeper integration where the function performs JWT signing on behalf of the SDK — that's a different architecture and would require VIDA's SDK to support a signed-token mode. Not in scope here.

---

## Repo File Layout (Final)

```
vida-sdk-tester/
├── README.md                          # Repo overview
├── TUTORIAL.md                        # This file
├── netlify.toml                       # Netlify build/function config
├── .gitignore                         # Keeps .env out of git
├── index.html                         # Tester UI (no secrets)
└── netlify/
    └── functions/
        └── vida-token.js              # Server-side credential minter
```

---

## Contact

If you hit something specific to VIDA's OAuth endpoint or SDK behavior, ping me:

**Hasan** · Solution Engineer, VIDA
hasan@vida.id · +62 812-9218-5638
