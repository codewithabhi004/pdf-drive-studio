# PDF Drive Studio

A mobile-friendly PDF workspace built with React, Vite, Tailwind CSS, PDF.js, and pdf-lib. PDF tools run in the browser; Google Drive sync is optional.

The deployed privacy policy is available at `/privacy.html`.

## Run locally

```bash
npm ci
npm run dev
```

Create a Google OAuth web client, enable the Google Drive API, and add your local and deployed URLs as authorized JavaScript origins. Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID` to the client ID. Do not commit `.env`.

## Deploy to GitHub Pages

The GitHub Actions workflow builds and deploys the site when changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The site is published at `https://codewithabhi004.github.io/pdf-drive-studio/`. The build automatically uses the repository subpath for assets and the PWA manifest.

Google Drive sign-in remains optional. To configure it later, add a `VITE_GOOGLE_CLIENT_ID` repository variable and include `https://codewithabhi004.github.io` in the OAuth client's authorized JavaScript origins.

## Build

```bash
npm run build
```
