# 🚀 Final Step: Push to GitHub

I have already initialized the Git repository and committed your code locally in the `clearhire_production` folder.

## 1️⃣ Create Repository on GitHub
1. Go to **[GitHub.com/new](https://github.com/new)**.
2. Name the repository: `clearhire-app` (or anything you like).
3. **Important**: Do NOT check "Add a README", "Add .gitignore", or "Choose a license". Create an empty repository.
4. Click **Create repository**.

## 2️⃣ Connect & Push
Copy the commands shown on GitHub under "…or push an existing repository from the command line" and run them in your terminal here.

They will look like this:
```bash
cd clearhire_production

git remote add origin https://github.com/YOUR_USERNAME/clearhire-app.git
git branch -M main
git push -u origin main
```

## 3️⃣ Deploy to Render
Once your code is on GitHub:
1. Go to **[dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** -> **Web Service**.
3. Select "Build and deploy from a Git repository".
4. Connect your `clearhire-app` repo.
5. Render should auto-detect the `Procfile`.
6. **Add Environment Variables**:
   - `DATABASE_URL`: (Render might auto-supply this if you add a Postgres DB, otherwise skip for now to use SQLite temporarily, but Postgres is highly recommended).
   - `GOOGLE_CREDENTIALS_JSON`: Copy the content of `backend/credentials.json` and paste it here.

7. Click **Create Web Service**.

🎉 **Your app will be live in minutes!**
