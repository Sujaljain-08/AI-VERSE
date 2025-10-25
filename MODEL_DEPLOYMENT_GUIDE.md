# ML Model Deployment Guide

Your Python FastAPI server needs to be deployed separately from your Next.js frontend. Here are the best options:

## Option 1: Railway (Recommended - Easiest) ⭐

### Step 1: Prepare Your Code

Create a `Procfile` in your model_prediction folder:
```
web: uvicorn api:app --host 0.0.0.0 --port $PORT
```

Create a `.railwayignore` file:
```
.git
.gitignore
__pycache__
*.pyc
.env.local
node_modules
```

### Step 2: Create a Deployment Package

Create a `setup.sh` in `model_prediction/`:
```bash
#!/bin/bash
cd model_prediction
pip install -r requirements-api.txt
```

### Step 3: Deploy to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway will auto-detect the Python app
5. Add environment variables:
   - `PORT`: 8000 (Railway sets this automatically)

6. Deploy!

Your model will be available at: `https://your-railway-app.railway.app`

---

## Option 2: Render (Also Great)

### Step 1: Create `render.yaml`

```yaml
services:
  - type: web
    name: ai-verse-ml
    env: python
    plan: starter
    buildCommand: "pip install -r model_prediction/requirements-api.txt"
    startCommand: "uvicorn model_prediction.api:app --host 0.0.0.0 --port 8000"
    envVars:
      - key: PYTHONUNBUFFERED
        value: true
```

### Step 2: Deploy

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. It will auto-detect `render.yaml`
5. Deploy!

Your model will be available at: `https://your-app.onrender.com`

---

## Option 3: AWS EC2 (Most Control)

### Step 1: Launch an EC2 Instance

- Instance type: `t3.micro` (free tier eligible)
- OS: Ubuntu 22.04
- Security group: Allow ports 8000 (ML API)

### Step 2: SSH into Instance

```bash
ssh -i your-key.pem ubuntu@your-instance-ip
```

### Step 3: Install Dependencies

```bash
sudo apt update
sudo apt install python3-pip git
git clone https://github.com/your-username/AI-VERSE.git
cd AI-VERSE/model_prediction
pip install -r requirements-api.txt
```

### Step 4: Run the Server

```bash
uvicorn api:app --host 0.0.0.0 --port 8000
```

### Step 5: Keep Running (Use screen or PM2)

```bash
# Using screen
screen -S ml-server
uvicorn api:app --host 0.0.0.0 --port 8000
# Press Ctrl+A then D to detach

# Or use PM2
npm install -g pm2
pm2 start "uvicorn api:app --host 0.0.0.0 --port 8000" --name "ml-api"
```

---

## Step 4: Update Your Next.js Frontend

After deploying, update the WebSocket URL in your frontend:

### File: `app/exam/[id]/page.tsx`

Find this line (~160):
```tsx
const WS_URL = 'ws://localhost:8000/analyze';
```

Replace with your deployed URL:
```tsx
const WS_URL = process.env.NEXT_PUBLIC_ML_SERVER_URL || 'ws://localhost:8000/analyze';
```

### Add to `.env.local`:
```
NEXT_PUBLIC_ML_SERVER_URL=wss://your-railway-app.railway.app/analyze
```

### Add to Vercel Environment Variables:
```
NEXT_PUBLIC_ML_SERVER_URL=wss://your-railway-app.railway.app/analyze
```

---

## Testing Your Deployment

### Test 1: API Health Check

```bash
curl https://your-railway-app.railway.app/docs
```

You should see the FastAPI Swagger documentation.

### Test 2: WebSocket Connection

Use the test file:
```bash
# Open test-websocket.html in your browser
# Or use wscat
npm install -g wscat
wscat -c wss://your-railway-app.railway.app/analyze
```

### Test 3: Full End-to-End

1. Deploy frontend to Vercel
2. Start exam with WebSocket URL pointing to your ML server
3. Check browser console for connection success

---

## Environment Variables Summary

### Local Development (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://povokpovvyapwllgxvdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_ML_SERVER_URL=ws://localhost:8000/analyze
```

### Vercel Production
```
NEXT_PUBLIC_SUPABASE_URL=https://povokpovvyapwllgxvdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_ML_SERVER_URL=wss://your-deployed-ml.railway.app/analyze
```

---

## Recommended Deployment Path

1. ✅ **Deploy Frontend to Vercel** (DONE - code is ready)
2. ⏳ **Deploy ML Server to Railway** (5-10 minutes)
3. ⏳ **Add Environment Variables**
4. ⏳ **Update Supabase Auth Redirect URLs**
5. ⏳ **Test End-to-End**

---

## Quick Railway Deployment Checklist

- [ ] Go to railway.app and create account
- [ ] Create new project from GitHub
- [ ] Select AI-VERSE repository
- [ ] Configure build command: `pip install -r model_prediction/requirements-api.txt`
- [ ] Configure start command: `uvicorn model_prediction.api:app --host 0.0.0.0 --port 8000`
- [ ] Copy the Railway URL
- [ ] Add `NEXT_PUBLIC_ML_SERVER_URL=wss://[railway-url]/analyze` to Vercel
- [ ] Redeploy frontend
- [ ] Test WebSocket connection

---

## Common Issues & Fixes

### Issue: WebSocket connection fails
**Solution**: Make sure URL is `wss://` (secure) for HTTPS deployments, not `ws://`

### Issue: CORS errors
**Solution**: Check that CORSMiddleware in api.py has `allow_origins=["*"]`

### Issue: "Module not found" errors
**Solution**: Make sure `requirements-api.txt` is in the root or specify correct path

### Issue: Connection timeout
**Solution**: Check deployment is running and ports are exposed (typically port 8000)

---

## Next: Supabase Configuration

After deployment, configure Supabase:

1. Go to https://app.supabase.com
2. Select your project
3. Authentication → URL Configuration
4. Add redirect URLs:
   ```
   http://localhost:3000/auth/callback
   https://your-vercel-app.vercel.app/auth/callback
   ```

5. Site URL: `https://your-vercel-app.vercel.app`

