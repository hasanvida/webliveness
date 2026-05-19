# VIDA Web SDK Tester — Hosted on Netlify

A web-based tester for the VIDA Web SDK (Liveness). Bearer Token and Signing Key are minted server-side by a Netlify Function using OAuth `client_credentials`, so you never paste them in the browser.

## Quick Start

1. Fork or clone this repo to your GitHub account
2. Connect the repo to Netlify
3. Set env vars in Netlify dashboard (see [TUTORIAL.md](./TUTORIAL.md))
4. Deploy — the tester runs at your Netlify URL

## Files

- `index.html` — the tester UI (no secrets, just User ID input)
- `netlify/functions/vida-token.js` — server-side function that mints the Bearer Token
- `netlify.toml` — Netlify build config
- `TUTORIAL.md` — full step-by-step setup guide

## Hasan @ VIDA Solution Engineering
hasan@vida.id · +62 812-9218-5638
