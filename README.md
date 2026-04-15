# Candid — Personal Finance, Honestly

## Deploy to Vercel in 3 steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial Candid deploy"
   gh repo create candid-finance --public --push
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "Add New Project" → select your `candid-finance` repo
   - Vercel auto-detects Vite — just click **Deploy**
   - Your app is live at `candid-finance.vercel.app`

3. **Custom domain (optional)**
   - In Vercel → Settings → Domains → add `candid.finance`
   - Update your DNS with the values Vercel provides (~5 min)

## Local development

```bash
npm install
npm run dev
```

## Feedback form

The feedback banner links to `https://tally.so/r/CANDID` — create a free
Tally form at tally.so and replace this URL with your actual form link.

Suggested questions:
- How useful was your Candid report? (1–5)
- Which module surprised you most?
- What would you like Candid to cover that it doesn't yet?
- Would you share this with a friend? (Yes / Maybe / No)
- Email (optional — for early access updates)
