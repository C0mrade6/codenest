# Deploying CodeNest to Render (Free Tier)

## Step 1 — Push to GitHub
1. Create a new GitHub repo (e.g. `codenest`)
2. Extract this zip and push the entire `codenest/` folder as the repo root:
   ```
   cd codenest
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR_USERNAME/codenest.git
   git push -u origin main
   ```

## Step 2 — Deploy the Backend first
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Name:** codenest-server
   - **Root Directory:** server
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Click **Create Web Service**
5. Wait for it to deploy. Copy the URL it gives you — it looks like:
   `https://codenest-server.onrender.com`

## Step 3 — Deploy the Frontend
1. Go to Render → New → Static Site
2. Connect the same GitHub repo
3. Settings:
   - **Name:** codenest-client
   - **Root Directory:** client
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Under **Environment Variables**, add:
   - Key: `VITE_SERVER_URL`
   - Value: `https://codenest-server.onrender.com`  ← paste your backend URL here
5. Click **Create Static Site**

## Step 4 — Test it
- Open your static site URL in two browser tabs
- Enter the same Room ID in both
- Code edits sync in real time
- Click **▶ Run** to execute Python — output appears in both tabs
- Click **🎙 Join Voice** in both tabs to start a voice call

## Notes
- Free tier backend **spins down after 15 min of inactivity** — first request after sleep
  takes ~30 seconds. This is normal on free tier.
- Voice chat uses WebRTC peer-to-peer. The Render server only handles signaling (offer/answer),
  actual audio goes directly browser-to-browser via Google STUN servers.
- Python 3 is pre-installed on Render's Node.js runtime — `python3` works out of the box.
