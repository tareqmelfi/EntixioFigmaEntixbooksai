# Entix Books

Entix Books is a cloud accounting application for Saudi and US-oriented small and medium businesses. It supports bilingual Arabic and English workflows, RTL/LTR layout switching, ZATCA-oriented invoicing flows, sales, purchasing, contacts, reporting, and organization settings.

## Project

- Product: Entix Books
- Project code: EN-PRJ-ENTX-IO
- Domain: entix.io
- Frontend stack: Vite 6, React 18, TypeScript, Tailwind CSS 4, React Router 7
- Backend stack: Hono, Prisma, better-auth, PostgreSQL 16
- Public entity footer: ENSIDEX LLC, Wyoming, USA

## Design System

Locked brand colors:

```css
--entix-navy: #0B1B49;
--entix-blue: #1276E3;
--entix-cyan: #05B6FA;
--entix-red: #E84B4B;
```

Typography:

- Arabic: Noto Sans Arabic with system fallbacks
- English: system UI stack
- Do not use banned fonts listed in the project AGENTS instructions.

## Local Development

```bash
npm install
npm run dev
npm run build
```

## Deployment

Production is served at `entix.io` through Hostinger VPS and Coolify. Pushing `main` is expected to trigger the frontend deploy pipeline, followed by Cloudflare cache verification or purge when needed.

Always verify the live bundle hash after deployment.
