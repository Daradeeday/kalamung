# LINE Work-Link Bot (Vercel)
This project is a ready-to-deploy LINE webhook that accepts **work links** (Google Drive, YouTube, etc.)
from students and saves them into **Firestore** as documents in `works` collection.

## Features
- Register student with `ลงทะเบียน <studentId>`
- Save work by sending a message:
  ```
  ชื่อ: <project title>
  ลิงก์: https://...
  คำอธิบาย: <optional description>
  ```
- Bot validates link reachability and stores `validLink` flag in Firestore.

## Deploy on Vercel (recommended)
1. Create a Firebase project and enable **Firestore** (Native mode).
2. In Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.
   - Copy the JSON content and `JSON.stringify()` it (or paste as single-line).
3. Create a Vercel project and link your Git repository (or use `vercel` CLI).
4. Set the following Environment Variables in Vercel Project Settings:
   - `LINE_CHANNEL_ACCESS_TOKEN` - your LINE channel access token
   - `LINE_CHANNEL_SECRET` - your LINE channel secret
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` - the entire service account JSON (stringified)
5. Ensure the file `api/webhook.js` is present in the repository root (this project includes it).
6. Deploy. After deployment, configure LINE Developer Console -> Messaging API -> Webhook URL:
   - Set to `https://yourdomain.com/webhook` (we map `/webhook` automatically via Vercel routing)
   - Turn **Use Webhook** ON.

## Local testing with Vercel CLI
- Install Vercel CLI: `npm i -g vercel`
- Run: `vercel dev` and the local serverless function will be available at `http://localhost:3000/webhook`.
- Alternatively, you can use `ngrok` to expose a local express server if you adapt the code.

## Firestore structure
Collection `students`:
- doc id: LINE userId
- fields: `{ studentId: string, linkedAt: timestamp }`

Collection `works`:
- `{ studentLineId, studentId, title, link, description, uploadedAt, validLink, approved }`

## Notes & Security
- Keep `GOOGLE_APPLICATION_CREDENTIALS_JSON` secret.
- Use Firestore rules so clients cannot write `works` directly if you require server-side control.
- If you prefer storing thumbnails, consider creating thumbnails in a server process and storing small data URIs.

## Files included
- `api/webhook.js` — Vercel serverless function (main webhook)
- `.env.example` — example env variables
- `package.json` — basic package file
- `README.md` — this file


## Frontend gallery
- A starter React app is included in `frontend/` that calls `/api/gallery`.
- You can build and deploy it separately (or integrate into Vercel as a static site).
