Kalamung - Complete (frontend + backend)

How to use:
1. Install (root)
   npm install

2. Local frontend dev:
   npm --prefix frontend install
   npm --prefix frontend run dev

3. Build production:
   npm run build
   The frontend build will output to frontend/dist

4. Deploy on Vercel:
   - Connect repo to Vercel
   - Ensure Environment Variables are set (see below)
   - Vercel will run build and deploy both API and frontend

Environment variables required (set in Vercel project settings):
- GOOGLE_APPLICATION_CREDENTIALS_JSON  (stringified Firebase service account JSON)
- LINE_CHANNEL_ACCESS_TOKEN
- LINE_CHANNEL_SECRET
- ADMIN_TOKEN

Notes:
- Do NOT commit your service account file to git. Store it only in Vercel env.
- After deploy, set LINE Webhook URL to: https://YOUR_DOMAIN/webhook
