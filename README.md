# PDF Drive Studio

A mobile-friendly PDF workspace built with React, Vite, Tailwind CSS, PDF.js, and pdf-lib. PDF tools run in the browser; Google Drive sync is optional.

The deployed privacy policy is available at `/privacy.html`.

## Run locally

```bash
npm ci
npm run dev
```

Create a Google OAuth web client, enable the Google Drive API, and add your local and deployed URLs as authorized JavaScript origins. Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID` to the client ID. Do not commit `.env`.

## Deploy to Vercel

Import this repository into Vercel and use `npm run build` as the build command with `dist` as the output directory. Set `VITE_GOOGLE_CLIENT_ID` in the Vercel project environment variables, and add the deployed domain to the OAuth client's authorized JavaScript origins.

## Build

```bash
npm run build
```
