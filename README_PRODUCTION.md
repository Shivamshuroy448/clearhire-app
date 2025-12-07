# ClearHire Production Deployment Guide

This folder contains the production-ready code for ClearHire.

## Ready for Cloud
This version has been modified to support:
1. **PostgreSQL Database**: Configured via `DATABASE_URL` environment variable.
2. **Environment Secrets**: Google Credentials can be passed via `GOOGLE_CREDENTIALS_JSON`.
3. **Relative Frontend Paths**: The frontend automatically adjusts to the domain it's hosted on.
4. **Dependencies**: `requirements.txt` includes `psycopg2-binary` for Postgres.

## How to Deploy to Render

1. **Create a GitHub Repository** and push the contents of this `clearhire_production` folder to the root of the repo.
   - Alternatively, push the whole project and set the "Root Directory" in Render to `clearhire_production`.

2. **New Web Service on Render**:
   - Connect your GitHub repo.
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` (or use the included `Procfile`)

3. **Environment Variables**:
   Add these in the Render Dashboard:
   - `DATABASE_URL`: (Create a "Render PostgreSQL" database and link it, Render handles this automatically usually)
   - `GOOGLE_CREDENTIALS_JSON`: Paste the content of your `credentials.json` file here.
   - `PYTHON_VERSION`: `3.9.0` (Optional)

## Local Testing of Production Build
To test this specific folder locally:
```bash
cd backend
# Make sure you have the requirements
pip install -r requirements.txt
# Run
uvicorn main:app --reload
```
Visit http://localhost:8000
