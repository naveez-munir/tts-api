# Architecture & Technical Stack

## Architecture Overview

**Separate Backend and Frontend Applications:**

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATION                      │
│  Next.js 16 + React 19 + TypeScript + Tailwind CSS         │
│  Deployed on: Vercel                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    REST API (JSON)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND APPLICATION                       │
│  NestJS + TypeScript + Prisma ORM                           │
│  Deployed on: Railway or Render                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────┐  ┌──────────────────────┐
│   PostgreSQL 15+     │  │   Redis (BullMQ)     │
│   (Relational DB)    │  │   (Job Queue)        │
│   Railway/Supabase   │  │   Upstash/Railway    │
└──────────────────────┘  └──────────────────────┘
```

---

## Frontend Application

### Framework & Libraries

- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19
- **Language**: TypeScript 5 (strict mode enabled)
- **Styling**: Tailwind CSS 4
- **Form Handling**: React Hook Form with Zod validation
- **State Management**:
  - React Context API for auth state
  - Zustand for complex state (booking flow, multi-step forms)
- **HTTP Client**: Axios with custom wrapper for API calls
- **Authentication**: JWT-based (tokens stored in httpOnly cookies)
- **Deployment**: Vercel

### Key Features

- Server-side rendering (SSR) for SEO
- Client-side routing with App Router
- Responsive design (mobile-first)
- Progressive enhancement
- Optimized images (Next.js Image component)

### Directory Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── (marketing)/       # Marketing pages (landing, about, etc.)
│   ├── (booking)/         # Booking flow pages
│   ├── dashboard/         # Customer dashboard
│   ├── operator/          # Operator portal
│   ├── admin/             # Admin panel
│   └── api/               # API route handlers (if any client-side API routes)
├── components/
│   ├── ui/                # Reusable UI components (Button, Input, Card, etc.)
│   ├── forms/             # Form components (BookingForm, BidForm, etc.)
│   ├── layout/            # Layout components (Header, Footer, Sidebar)
│   └── features/          # Feature-specific components
├── lib/
│   ├── api/               # API client functions
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── validations/       # Zod schemas for forms
│   └── constants.ts       # App constants
├── types/                 # Frontend-specific types
└── styles/                # Global styles, Tailwind config
```

---

## Backend Application

### Framework & Libraries

- **Runtime**: Node.js 20+ LTS
- **Framework**: NestJS (TypeScript-based)
- **Language**: TypeScript 5 (strict mode enabled)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5+
- **Authentication**: Passport.js with JWT strategy
- **Job Queue**: BullMQ with Redis
- **Validation**: Zod schemas for request/response validation
- **API Documentation**: Swagger/OpenAPI (auto-generated)
- **Deployment**: Railway or Render

### Architecture Pattern

- **Controllers**: Handle HTTP requests, validate input (DTOs)
- **Services**: Business logic, orchestration
- **Repositories**: Data access layer (Prisma)
- **Guards**: Authentication and authorization
- **Interceptors**: Response transformation, logging
- **Pipes**: Validation (Zod validation pipe)
- **Jobs**: Background tasks (BullMQ workers)

### Directory Structure

```
backend/
├── src/
│   ├── modules/           # NestJS modules (feature-based)
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── jobs/
│   │   ├── bids/
│   │   ├── operators/
│   │   ├── payments/
│   │   └── notifications/
│   ├── common/            # Shared code
│   │   ├── guards/        # Auth guards, role guards
│   │   ├── interceptors/  # Response transformation, logging
│   │   ├── pipes/         # Validation pipes (Zod)
│   │   ├── decorators/    # Custom decorators
│   │   └── filters/       # Exception filters
│   ├── integrations/      # Third-party API integrations
│   │   ├── stripe/
│   │   ├── google-maps/
│   │   ├── sendgrid/
│   │   └── twilio/
│   ├── jobs/              # BullMQ job processors
│   ├── prisma/            # Prisma service
│   ├── config/            # Configuration files
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Prisma schema
│   ├── migrations/        # Database migrations
│   └── seed.ts            # Database seeding script
└── test/                  # Test files
```

---

## Database & Infrastructure

### Database

- **PostgreSQL 15+** on Supabase or Railway
- Relational database for data integrity
- ACID compliance for financial transactions
- Proper indexes for performance

### Redis

- **Upstash Redis** or Railway Redis
- Job queue storage (BullMQ)
- Caching layer (optional for MVP)
- Session storage (optional)

### File Storage

- **AWS S3** or **Cloudinary** for operator document uploads
- Secure signed URLs for document access
- File type validation (PDF, JPG, PNG only)
- File size limits (5MB per document)

---

## Third-Party Integrations

| Service | Purpose | Estimated Cost | Priority |
|---------|---------|----------------|----------|
| **Stripe** | Payment processing, payouts | 2.9% + 30p per transaction | Critical |
| **Google Maps API** | Distance calculation, autocomplete | ~£5-7 per 1000 requests | Critical |
| **SendGrid/Mailgun** | Transactional emails | Free - £20/month | Critical |
| **Twilio** | SMS notifications | ~£0.04 per SMS | High |
| **AWS S3/Cloudinary** | File storage | £5-10/month | High |

---

## Environment Variables

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

### Backend (.env)

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_MAPS_API_KEY=...
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
```

---

## Deployment

### Frontend (Vercel)

1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Automatic deployments on push to main branch
4. Preview deployments for pull requests

### Backend (Railway/Render)

1. Connect GitHub repository to Railway/Render
2. Configure environment variables
3. Set up PostgreSQL and Redis add-ons
4. Configure build command: `npm run build`
5. Configure start command: `npm run start:prod`
6. Set up health check endpoint: `GET /health`

### Database Migrations

- Run `npx prisma migrate deploy` in production
- Never run `prisma migrate dev` in production
- Always test migrations in staging environment first
