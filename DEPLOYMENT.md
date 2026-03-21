# Deployment Guide (Vercel)

This guide walks you through deploying the **OkNexus** application to Vercel, the creators of Next.js and the recommended hosting platform.

## Prerequisites

-   A [GitHub](https://github.com/) account.
-   A [Vercel](https://vercel.com/) account (you can sign up using GitHub).
-   Your project pushed to a GitHub repository.

## Step 1: Import Project to Vercel

1.  Log in to your **Vercel Dashboard**.
2.  Click on **"Add New..."** and select **"Project"**.
3.  In the "Import Git Repository" section, you should see your GitHub repositories listed.
4.  Find `OkNexus` (or your repository name) and click **"Import"**.

## Step 2: Configure Project

Vercel will automatically detect that this is a Next.js project and pre-fill most settings.

1.  **Framework Preset**: Should be `Next.js`.
2.  **Root Directory**: Leave as `./`.
3.  **Build and Output Settings**: Leave as default (`next build`, etc.).

## Step 3: Environment Variables (CRITICAL)

You must add the environment variables from your `.env.local` to Vercel for the app to work correctly.

1.  Expand the **"Environment Variables"** section.
2.  Add the following variables one by one (copy values from your local `.env.local`):

| Key | Description |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console (OAuth) |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (OAuth) |
| `NEXTAUTH_SECRET` | Your generated secret (e.g. from `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | **Set this to your Vercel public URL** (e.g. `https://your-project.vercel.app`) or leave empty if Vercel handles it automatically (NextAuth v5+ often detects host), but for v4 it is safer to set it to your production domain once deployed. **Initially, you can skip this** or set it to `http://localhost:3000` just for build, but you MUST update it to the real domain after the first deployment. |
| `GROQ_API_KEY` | Your AI API Key |
| `NEXT_PUBLIC_AI_ENABLED` | `true` |

> **Note**: For `NEXTAUTH_URL`, after your first deployment generates a URL (like `oknexus.vercel.app`), go back to Vercel Settings > Environment Variables, add/update `NEXTAUTH_URL` to that real URL, and Redeploy. You also need to add that domain to your **Google Cloud Console** "Authorized JavaScript origins" and "Authorized redirect URIs".

## Step 4: Deploy

1.  Click **"Deploy"**.
2.  Vercel will build your application. You can watch the build logs.
3.  Once complete, you will see a success screen with a screenshot of your app.

## Post-Deployment Configuration

### Google OAuth Redirect URI
Your production app will fail to log in if you don't update Google Console.

1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project.
3.  Go to **APIs & Services > Credentials**.
4.  Edit your OAuth 2.0 Client ID.
5.  Add your new Vercel domain to:
    -   **Authorized JavaScript origins**: `https://your-project-name.vercel.app`
    -   **Authorized redirect URIs**: `https://your-project-name.vercel.app/api/auth/callback/google`

### Redeploy (if needed)
If you changed environment variables (like `NEXTAUTH_URL`), go to the **Deployments** tab in Vercel, click the three dots on the latest deployment, and select **"Redeploy"**.
