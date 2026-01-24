# Airport Transfer Booking Platform

**Version:** 1.0
**Last Updated:** December 2025
**Architecture:** Separate Backend (NestJS) + Frontend (Next.js)

## Project Overview

Marketplace platform connecting customers seeking airport transfers with registered transport operators across the UK.

### Business Model

- **Asset-light aggregator**: No vehicle ownership
- **Bidding system**: Jobs broadcast to all operators, lowest bid wins
- **Revenue model**: Commission (Customer Price - Winning Bid)
- **Primary service**: Airport transfers with point-to-point support

### Core Differentiator

Automated bidding system where all registered operators in the service area receive job notifications and compete by submitting bids. The lowest bid automatically wins, maximizing platform margin while ensuring competitive pricing.

### Target Timeline

**10-12 weeks for MVP** (Minimum Viable Product)

---

## Quick Navigation

- **[Features](./FEATURES.md)** - Complete feature scope and what's out of scope
- **[Architecture](./ARCHITECTURE.md)** - Technical stack and system architecture
- **[Code Standards](./CODE_STANDARDS.md)** - TypeScript, NestJS, and coding conventions
- **[Development](./DEVELOPMENT.md)** - Git workflow, testing, and deployment
- **[Design Standards](./DESIGN_STANDARDS.md)** - UI/UX and responsive design requirements
- **[AI Rules](./AI_RULES.md)** - Scope control rules for AI-assisted development

---

## Key Takeaways

1. **Scope Discipline**: Only implement features listed in FEATURES.md. No additions without explicit approval.
2. **Architecture**: Separate NestJS backend + Next.js frontend with shared types package.
3. **Core Feature**: Bidding system where operators compete for jobs - this is the differentiator.
4. **Timeline**: 10-12 weeks for MVP with focused scope.
5. **Quality**: Type-safe, tested, accessible, responsive, and secure.

---

## Development Phases

1. **Phase 1**: Project setup, database schema, authentication
2. **Phase 2**: Customer booking flow, quote engine, Google Maps integration
3. **Phase 3**: Stripe payment integration, booking confirmation
4. **Phase 4**: Operator portal, registration, job viewing
5. **Phase 5**: Bidding system, job assignment, notifications
6. **Phase 6**: Admin panel, operator management, reports
7. **Phase 7**: Testing, bug fixes, security audit
8. **Phase 8**: Deployment, monitoring setup

---

**Document Status**: ✅ Complete
**Repository**: tts-api (Backend only - this repo)
