# Development Workflow & Best Practices

## Git Workflow

### Branch Naming

- `feature/booking-flow`
- `fix/payment-validation`
- `refactor/api-responses`

### Commit Message Format

`type(scope): description`

**Examples:**
- `feat(booking): add quote calculation`
- `fix(auth): resolve token expiration`

**Types:** feat, fix, refactor, docs, test, chore

### Commit Best Practices

- Keep commits atomic and focused
- Write descriptive commit messages explaining "why" not just "what"
- Reference issue numbers when applicable

---

## Testing Requirements

### Backend Testing

- Unit tests for services and utility functions (Jest)
- Integration tests for API endpoints (Supertest)
- Test database operations with test database or mocks
- Test coverage target: 70%+ for critical paths (booking flow, bidding system, payment processing)

**Example:**

```typescript
describe('AuthService', () => {
  it('should hash password on user creation', async () => {
    const user = await usersService.create({
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'CUSTOMER',
    });

    expect(user.password).not.toBe('Password123');
    expect(user.password.length).toBeGreaterThan(20);
  });
});
```

### Frontend Testing

- Component tests for UI components (React Testing Library)
- Integration tests for forms and user flows
- E2E tests for critical paths (Playwright or Cypress) - optional for MVP
- Test coverage target: 60%+ for critical components

---

## Code Review Checklist

### Code Quality

- [ ] TypeScript strict mode compliance (no `any`, proper types)
- [ ] Zod validation for all user inputs and API requests
- [ ] Error handling implemented (try-catch, error boundaries)
- [ ] Loading and error states in UI
- [ ] No hardcoded values (use environment variables for config)
- [ ] No sensitive data in logs or client-side code

### Security

- [ ] Authentication and authorization checks in place
- [ ] Input sanitization to prevent XSS/SQL injection
- [ ] Rate limiting on sensitive endpoints (login, payment)
- [ ] Proper HTTP status codes used
- [ ] CORS configured correctly

### Performance

- [ ] Database queries optimized (proper indexes, avoid N+1 queries)
- [ ] API responses follow standard format
- [ ] Responsive design tested at multiple breakpoints

### Accessibility

- [ ] Keyboard navigation works
- [ ] ARIA labels present where needed
- [ ] Color contrast meets WCAG 2.1 AA standards

---

## Security Best Practices

### Authentication & Authorization

```typescript
// ✅ CORRECT - Protected route with role check
@Get('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
async getAdminDashboard(@CurrentUser() user: User) {
  return this.adminService.getDashboard(user.id);
}
```

### Input Validation

```typescript
// ✅ CORRECT - Zod validation
export const CreateBookingSchema = z.object({
  pickupLocation: z.object({
    address: z.string().min(1).max(500),
    postcode: z.string().regex(/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  // ...
});
```

### Password Security

```typescript
// ✅ CORRECT - Use bcrypt with proper salt rounds
const hashedPassword = await bcrypt.hash(password, 10);

// ✅ CORRECT - Use bcrypt.compare for verification
const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
```

### Rate Limiting

```typescript
// ✅ CORRECT - Rate limit sensitive endpoints
@Post('login')
@Throttle(5, 60) // 5 requests per 60 seconds
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### Environment Variables

```typescript
// ✅ CORRECT - Never commit .env files
// Use ConfigService for environment variables
constructor(private configService: ConfigService) {
  const jwtSecret = this.configService.get<string>('JWT_SECRET');
}
```

---

## Monitoring & Logging

### Logging Levels

- **error**: Application errors, exceptions
- **warn**: Warning messages, deprecated API usage
- **info**: General application flow, startup messages
- **debug**: Detailed debugging information (dev only)

### Logging Best Practices

```typescript
// ✅ CORRECT - Structured logging
this.logger.log('User registered', {
  userId: user.id,
  email: user.email,
  role: user.role,
});

// ❌ INCORRECT - Don't log sensitive data
this.logger.log('User login', {
  email: user.email,
  password: user.password, // ❌ NEVER LOG PASSWORDS
});
```

### Error Tracking

- Set up error tracking (Sentry or similar) - optional for MVP
- Monitor API response times and error rates
- Set up database query monitoring
- Track failed login attempts
- Monitor payment processing errors

---

## Performance Optimization

### Database Queries

```typescript
// ✅ CORRECT - Use proper indexes
// In Prisma schema:
model User {
  id       String @id @default(uuid())
  email    String @unique // Indexed automatically

  @@index([role, createdAt]) // Composite index for filtering
}

// ✅ CORRECT - Use select to fetch only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
  },
});

// ❌ INCORRECT - N+1 query problem
const bookings = await prisma.booking.findMany();
for (const booking of bookings) {
  const user = await prisma.user.findUnique({ where: { id: booking.userId } });
}

// ✅ CORRECT - Use include/join
const bookings = await prisma.booking.findMany({
  include: {
    user: true,
  },
});
```

### API Response Caching

```typescript
// ✅ CORRECT - Cache expensive operations
const cacheKey = `quote:${pickupLat}:${pickupLng}:${dropoffLat}:${dropoffLng}`;
const cachedQuote = await redis.get(cacheKey);

if (cachedQuote) {
  return JSON.parse(cachedQuote);
}

const quote = await this.calculateQuote(pickup, dropoff);
await redis.setex(cacheKey, 86400, JSON.stringify(quote)); // 24 hours
return quote;
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Environment variables configured in production
- [ ] Database migrations tested in staging
- [ ] API documentation updated
- [ ] Security review completed
- [ ] Performance testing completed
- [ ] Error tracking configured

### Production Deployment

- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Verify environment variables
- [ ] Check health endpoint: `GET /health`
- [ ] Monitor logs for errors
- [ ] Test critical user flows
- [ ] Verify webhook endpoints (Stripe)

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check API response times
- [ ] Verify payment processing
- [ ] Test email/SMS notifications
- [ ] Monitor database performance

---

## Debugging & Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check DATABASE_URL environment variable
echo $DATABASE_URL

# Test database connection
npx prisma db pull
```

**JWT Token Issues:**
```typescript
// Verify JWT secret is set
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not defined');
}
```

**Stripe Webhook Failures:**
```typescript
// Verify webhook signature
const sig = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  request.rawBody,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### Debug Mode

```bash
# Run in debug mode
npm run start:debug

# Attach debugger on port 9229
# VS Code launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Attach to NestJS",
  "port": 9229,
  "restart": true
}
```

---

## Development Scripts

```bash
# Development
npm run start:dev          # Start dev server with watch mode
npm run db:studio          # Open Prisma Studio
npm run db:seed            # Seed database with test data

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Generate coverage report
npm run test:e2e           # Run end-to-end tests

# Production
npm run build              # Build for production
npm run start:prod         # Start production server

# Database
npx prisma migrate dev     # Create and apply migration (dev)
npx prisma migrate deploy  # Apply migrations (production)
npx prisma generate        # Generate Prisma Client
npx prisma studio          # Open Prisma Studio
```
