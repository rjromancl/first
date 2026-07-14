# Deployment Guide — British Airways App

## Architecture

```
Phone / Browser (anywhere)
        │
        ▼
  Vercel (Frontend)          ← React + Vite  — free HTTPS URL
  https://your-app.vercel.app
        │  VITE_API_URL
        ▼
  Railway (Backend)          ← Node/Express  — free HTTPS URL
  https://your-backend.up.railway.app
```

---

## Prerequisites

Install these CLIs once (free):

```bash
npm install -g vercel
npm install -g @railway/cli
```

---

## Step 1 — Push code to GitHub

Both Railway and Vercel deploy from GitHub.

### 1a — Create two GitHub repos

Go to https://github.com/new and create:

- `british-airways-frontend`  (for the root folder)
- `british-airways-backend`   (for the `backend/` folder)

### 1b — Push the backend

```bash
cd C:\Users\2927574\Downloads\project\british-airways-app\backend
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/british-airways-backend.git
git push -u origin main
```

### 1c — Push the frontend

```bash
cd C:\Users\2927574\Downloads\project\british-airways-app
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/british-airways-frontend.git
git push -u origin main
```

> `.env.local` and `.env` are in `.gitignore` — secrets are never committed.

---

## Step 2 — Deploy backend to Railway

### 2a — Sign up and deploy

1. Go to https://railway.app and sign up (free, GitHub login recommended)
2. Click **New Project → Deploy from GitHub repo**
3. Select `british-airways-backend`
4. Railway auto-detects Node.js and runs `npm start`

### 2b — Set environment variables in Railway

In your Railway project → **Variables** tab, add these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `JWT_SECRET` | any long random string e.g. `ba-prod-secret-xyz-2026` |
| `JWT_EXPIRES_IN` | `7d` |
| `AMADEUS_CLIENT_ID` | `YOUR_AMADEUS_CLIENT_ID` (or leave placeholder) |
| `AMADEUS_CLIENT_SECRET` | `YOUR_AMADEUS_CLIENT_SECRET` (or leave placeholder) |
| `AMADEUS_HOSTNAME` | `test` |
| `RATE_LIMIT_MAX` | `200` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |

> `ALLOWED_ORIGINS` is **not needed** — the backend already allows all `https://` origins in production.

### 2c — Get your Railway URL

After deploy (takes ~2 minutes), Railway shows your URL:
```
https://british-airways-backend-production.up.railway.app
```

**Copy this URL** — you need it in Step 3.

### 2d — Verify backend is live

Open in browser:
```
https://YOUR_RAILWAY_URL/health
```
Should return: `{"status":"ok",...}`

---

## Step 3 — Deploy frontend to Vercel

### 3a — Sign up and deploy

1. Go to https://vercel.com and sign up (free, GitHub login)
2. Click **Add New → Project**
3. Import `british-airways-frontend` from GitHub
4. Vercel auto-detects Vite. Confirm these settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

### 3b — Set environment variables in Vercel

In **Project Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://YOUR_RAILWAY_URL/api` |
| `VITE_GEMINI_API_KEY` | `your gemini api key` |

> Replace `YOUR_RAILWAY_URL` with the actual URL from Step 2c.

### 3c — Deploy

Click **Deploy**. Takes ~1 minute. Vercel gives you a URL like:
```
https://british-airways-frontend.vercel.app
```

Open it on your phone — it works from anywhere in the world.

---

## Step 4 — Redeploy after any code change

```bash
# Frontend — push to GitHub, Vercel auto-redeploys
git add .
git commit -m "your change"
git push

# Backend — push to GitHub, Railway auto-redeploys
cd backend
git add .
git commit -m "your change"
git push
```

---

## Troubleshooting

### "Failed to fetch" / network error on phone
- Check `VITE_API_URL` in Vercel env vars — must be `https://`, not `http://`
- Redeploy frontend after changing env vars

### CORS error in browser console
- The backend allows all `https://` origins in production automatically
- Make sure `NODE_ENV=production` is set in Railway variables

### Railway deploy fails
- Check the **Deploy Logs** tab in Railway dashboard
- Common fix: make sure `package.json` has `"start": "node src/server.js"`

### Voice assistant not working on mobile
- Chrome on Android supports Web Speech API — use Chrome
- Safari on iOS supports it too
- Firefox mobile does NOT support Web Speech API — use text mode

### Gemini AI not responding
- Verify `VITE_GEMINI_API_KEY` is set correctly in Vercel env vars
- The fallback (basic intent matching) works without it

---

## Quick reference — URLs after deploy

| Service | URL |
|---------|-----|
| Frontend | `https://british-airways-frontend.vercel.app` |
| Backend health | `https://YOUR_RAILWAY_URL/health` |
| API base | `https://YOUR_RAILWAY_URL/api` |

---

## Demo credentials (pre-seeded)

| Field | Value |
|-------|-------|
| Email | `demo@ba.com` |
| Password | `demo1234` |
| Booking ref | `XYMBA1` / surname `Wilson` |
| Booking ref | `PLCNR7` / surname `Johnson` |
