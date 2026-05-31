# Environment Variables

```bash
# Server
PORT=5177
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/revenue_db
DB_POOL_MAX=5  # connections per process (90 total across PM2 cluster)

# Auth
AUTH_SERVER_URL=http://localhost:5176

# Redis
REDIS_URL=redis://localhost:6379

# Email (Phase 2)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=billing@example.com
SMTP_PASSWORD=secret

# Payments (Phase 5)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Workers
THREAD_POOL_SIZE=2  # Worker Threads per process
```
