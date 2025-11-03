Line Portfolio Bot - Complete package
Files included:
- api/webhook.js           (robust LINE webhook, connects to Firestore)
- api/gallery.js           (public API for approved works)
- api/admin/*              (admin endpoints: list/get/approve/reject)
- api/admin-ui.js          (temporary admin UI served from serverless)
- frontend/                (Vite React app: Gallery + link to admin-ui)
- package.json (root)     (build script + server deps)
- frontend/package.json    (frontend build)
- vercel.json              (routes + builds configured)

Setup:
1. In Vercel Project -> Settings -> Environment Variables add:
   - GOOGLE_APPLICATION_CREDENTIALS_JSON  (stringified JSON from Firebase service account)
   - LINE_CHANNEL_ACCESS_TOKEN
   - LINE_CHANNEL_SECRET
   - ADMIN_TOKEN (random secret for admin UI)
2. Push to GitHub and connect to Vercel (or upload zip and import)
3. Ensure Build Command is 'npm --prefix frontend run build' and Output Directory 'frontend/dist'
4. Deploy. Admin UI is available at: https://YOUR_VERCEL_DOMAIN/api/admin-ui
   Frontend gallery at: https://YOUR_VERCEL_DOMAIN/
5. Test LINE webhook at /webhook endpoint.

Security notes:
- Do NOT commit your service account file. Keep it in Vercel env only.
- Firestore rules should restrict writes from clients. Use server admin endpoints for writes.
