# AutoInvoice SaaS

AutoInvoice ist ein Full-Stack-SaaS f?r rechtssichere Rechnungen in Deutschland. Der Mono-Repo enth?lt:

- Backend (Express + Prisma + PostgreSQL) mit Authentifizierung, Rechnungs-API, PDF-Erzeugung und Stripe-Integration
- Frontend (Next.js + Tailwind) mit Auth-Flows, Invoice-Formular, Dashboard und Billing-Checkout
- Gemeinsame Typen & Utilities im Workspace `@autoinvoice/shared`

## Tech-Stack

- Node.js 20, TypeScript, npm Workspaces
- Express 4, Prisma ORM, PostgreSQL 15, Argon2, JWT
- PDF-Export mit pdfkit, lokaler Storage (S3-ready Extension m?glich)
- Stripe Checkout/Webhooks f?r Subscriptions
- Next.js 14 App Router, SWR, TailwindCSS
- Dockerfiles & `docker-compose.yml` f?r lokale Orchestrierung

## Quick Start (lokal)

```bash
npm install
npx prisma generate --schema apps/backend/prisma/schema.prisma
npx prisma migrate dev --schema apps/backend/prisma/schema.prisma --name init
npm run dev --workspace @autoinvoice/backend
npm run dev --workspace @autoinvoice/frontend
```

Backend l?uft standardm??ig auf `http://localhost:4000`, Frontend auf `http://localhost:3000`.

### Docker Compose

```bash
docker compose up --build
```

> Setze alle erforderlichen Umgebungsvariablen in `.env`-Dateien oder via Compose-Overrides. In Produktion `prisma migrate deploy` ausf?hren.

## Env-Variablen

`apps/backend/.env.example`

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoinvoice
JWT_SECRET=replace-me
JWT_EXPIRES_IN=1d
STRIPE_SECRET_KEY=sk_test_replace
STRIPE_WEBHOOK_SECRET=whsec_replace
STRIPE_PRICE_ID=price_replace
APP_BASE_URL=http://localhost:3000
STORAGE_BUCKET=autoinvoice-storage
```

`apps/frontend/.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Wichtige Pfade

- `apps/backend/src/modules/auth` ? Registrierung, Login, Profil
- `apps/backend/src/modules/invoice` ? CRUD, PDF-Export, Download, Storage
- `apps/backend/src/modules/billing` ? Stripe Checkout & Webhook
- `apps/frontend/app/(auth)` ? Login/Registrierung-UI
- `apps/frontend/app/dashboard` ? Invoice-Form, Invoice-Liste, Stripe-Button
- `docker-compose.yml` ? DB + Backend + Frontend Setup

## Security & Compliance Hooks

- Helmet, CORS, Rate-Limits, JWT-Auth, Argon2 Hashing
- CSP/Headers via Next.js Config
- Stripe-Webhooks mit Signaturpr?fung und Raw-Body-Handling
- DSGVO-Checkliste im Dashboard, Kleinunternehmer-Hinweis, Pflichtangaben auf PDF
- Logging-Hooks: `InvoiceService` schreibt Audit-Ready Daten (Erweiterbar)

## N?chste Schritte

1. Eigene Stripe-Keys & Preis-ID setzen, Webhook-Endpoint hinter HTTPS bereitstellen
2. S3 oder ?hnlichen Storage anbinden (`uploadPdfBuffer` austauschen)
3. Datenschutztexte (Impressum, AGB, Datenschutzerkl?rung) ins Frontend integrieren
4. Monitoring, Backups und Incident-Response-Plan operationalisieren
5. Penetration-Test durchf?hren, Ergebnisse priorisieren

## Lizenz

Interner Projektstand ? bitte projektintern abstimmen, bevor Code extern geteilt wird.
