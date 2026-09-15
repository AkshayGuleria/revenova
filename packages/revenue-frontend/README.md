# Revenova - Revenue Intelligence Frontend

```
╭──────────────────────────────────────────────────────────────────────────╮
│                                                                          │
│   ██████╗ ███████╗██╗   ██╗███████╗███╗   ██╗ ██████╗ ██╗   ██╗ █████╗   │
│   ██╔══██╗██╔════╝██║   ██║██╔════╝████╗  ██║██╔═══██╗██║   ██║██╔══██╗  │
│   ██████╔╝█████╗  ██║   ██║█████╗  ██╔██╗ ██║██║   ██║██║   ██║███████║  │
│   ██╔══██╗██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║  │
│   ██║  ██║███████╗ ╚████╔╝ ███████╗██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║  │
│   ╚═╝  ╚═╝╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝  │
│                                                                          │
│                    Revenue Intelligence Platform                         │
│                                                                          │
╰──────────────────────────────────────────────────────────────────────────╯
```

A comprehensive B2B SaaS dashboard for managing enterprise accounts, contracts, products, and invoices. Built with React Router 7, TanStack Query, shadcn/ui, and Tailwind CSS.

## Overview

This frontend application provides a complete user interface for the Revenova, enabling SaaS companies to manage:

- **Hierarchical Accounts** - Parent-child company relationships with 3+ level hierarchies
- **Contract Management** - Multi-year deals with seat-based licensing and auto-renewal
- **Product Catalog** - Flexible pricing models (flat, seat-based, volume-tiered)
- **Invoice Management** - Manual and automated invoice creation with line items
- **Billing Operations** - Sync/async invoice generation, batch billing, consolidated billing

**Status:** see [root README → Development Phases](../../README.md#development-phases)

## Features

### Implemented

- ✅ **Accounts Module**
  - List view with pagination and filtering
  - Create/edit accounts with validation
  - Account details with tabs (Overview, Hierarchy, Contracts, Invoices)
  - Hierarchical account visualization
  - Parent account selection with circular reference prevention

- ✅ **Contracts Module**
  - List view with account filtering
  - Create/edit contracts with seat-based pricing
  - Contract details with tabs (Overview, Billing, Invoices)
  - Contract timeline visualization
  - Auto-renewal settings management
  - Shared contracts for subsidiaries (Phase 3)

- ✅ **Products Module**
  - List view with pricing model filters
  - Create/edit products with dynamic pricing configuration
  - Product details with tabs (Overview, Pricing, Volume Tiers)
  - Visual volume tier display with discount badges
  - Seat configuration management

- ✅ **Invoices Module**
  - List view with status filtering
  - Manual invoice creation with line items
  - Invoice details with payment tracking
  - Edit invoice status and line items

- ✅ **Billing Module**
  - Sync invoice generation from contracts
  - Async invoice generation with job status tracking
  - Batch billing operations
  - Consolidated invoice generation (Phase 3)
  - Queue statistics dashboard

- ✅ **Dashboard**
  - Quick action buttons for common operations
  - Recent activity timeline
  - Key metrics cards (placeholder for analytics)

### Design Features

- **Gradient Design Language** - Color-coded cards with gradient headers (blue, emerald, amber, green, purple)
- **Tab-Based Navigation** - Consistent pattern across all detail pages
- **Icon Badges** - Semantic visual indicators with coordinated colors
- **Micro-interactions** - Smooth hover/active scale effects
- **Loading States** - Skeleton loaders matching final layouts
- **Empty States** - Clear CTAs for empty lists
- **Error Handling** - User-friendly error messages with retry options
- **Optimistic Updates** - Immediate UI feedback with rollback on error

## Tech Stack

- **Framework:** [React Router 7](https://reactrouter.com/) (formerly Remix) - Full-stack React framework with file-based routing
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) - Utility-first CSS with @theme directive
- **Data Fetching:** [TanStack Query v5](https://tanstack.com/query) - Server state management with caching, optimistic updates
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/) - Lightweight global state
- **Forms:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) - Type-safe form validation
- **Icons:** [Lucide React](https://lucide.dev/) - Beautiful, consistent icons
- **Date Handling:** [date-fns](https://date-fns.org/) - Modern date utility library
- **TypeScript:** Strict mode enabled for type safety

## Prerequisites

### Required Services

1. **Backend API** - Revenue Management Backend must be running on `http://localhost:5177`
   - See `packages/revenue-backend/README.md` for setup instructions
   - Ensure database migrations are run and test data is generated

2. **Node.js** - Version 20.x or higher recommended

### Environment Variables

Create a `.env` file in the frontend root:

```bash
# API Configuration
VITE_API_URL=http://localhost:5177

# Application Configuration
VITE_APP_NAME="Revenova"
```

## Installation

From the monorepo root or the frontend package directory:

```bash
# Install dependencies
npm install

# Or from monorepo root
npm install --workspace=packages/revenue-frontend
```

## Development

### Start Development Server

```bash
# From frontend directory
npm run dev

# Or from monorepo root
npm run dev:frontend

# Or run both backend + frontend
npm run dev:all
```

The application will be available at `http://localhost:5173`.

### Generate Test Data

Before using the application, generate test data in the backend:

```bash
cd packages/revenue-backend
npm run generate-data:clean
```

This creates:
- 5 products with various pricing models
- 14 accounts in a 3-level hierarchy
- 17 contracts with seat-based and volume-tiered pricing

### Development Workflow

1. **Make Changes** - Edit files in `app/` directory
2. **Hot Reload** - Changes reflect immediately (HMR enabled)
3. **Type Check** - TypeScript errors show in terminal
4. **Lint** - ESLint runs automatically on save (if configured)
5. **Test** - Use TESTING.md checklist for manual QA

## Project Structure

```
packages/revenue-frontend/
├── app/
│   ├── routes/                      # File-based routing
│   │   ├── _index.tsx               # Dashboard (/)
│   │   ├── accounts._index.tsx      # Accounts list
│   │   ├── accounts.new.tsx         # Create account
│   │   ├── accounts.$id.tsx         # Account details
│   │   ├── accounts.$id.edit.tsx    # Edit account
│   │   ├── contracts._index.tsx     # Contracts list
│   │   ├── contracts.$id.tsx        # Contract details
│   │   ├── products._index.tsx      # Products list
│   │   ├── invoices._index.tsx      # Invoices list
│   │   ├── billing.generate.tsx     # Generate invoice
│   │   └── billing.batch.tsx        # Batch billing
│   │
│   ├── components/                  # Reusable UI components
│   │   ├── ui/                      # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ... (30+ components)
│   │   ├── layout/                  # Layout components
│   │   │   ├── app-shell.tsx        # Main layout wrapper
│   │   │   ├── header.tsx           # Top navigation
│   │   │   ├── sidebar.tsx          # Side navigation
│   │   │   └── page-header.tsx      # Page title + actions
│   │   ├── accounts/                # Account-specific components
│   │   ├── contracts/               # Contract-specific components
│   │   ├── products/                # Product-specific components
│   │   ├── currency-display.tsx     # Currency formatter
│   │   ├── status-badge.tsx         # Status indicators
│   │   ├── page-loader.tsx          # Loading state
│   │   └── empty-state.tsx          # Empty list placeholder
│   │
│   ├── lib/                         # Utilities and hooks
│   │   ├── api/
│   │   │   ├── client.ts            # API client wrapper
│   │   │   ├── query-client.ts      # TanStack Query config
│   │   │   └── hooks/               # Data fetching hooks
│   │   │       ├── use-accounts.ts  # Account queries/mutations
│   │   │       ├── use-contracts.ts # Contract queries/mutations
│   │   │       ├── use-products.ts  # Product queries/mutations
│   │   │       ├── use-invoices.ts  # Invoice queries/mutations
│   │   │       └── use-billing.ts   # Billing operations
│   │   ├── stores/                  # Zustand stores
│   │   │   ├── auth-store.ts        # Auth state
│   │   │   └── ui-store.ts          # UI state (sidebar, theme)
│   │   ├── utils.ts                 # Utility functions (cn, formatters)
│   │   └── constants.ts             # App constants
│   │
│   ├── types/                       # TypeScript definitions
│   │   ├── api.ts                   # API response types
│   │   └── models.ts                # Domain models
│   │
│   ├── root.tsx                     # Root layout with providers
│   └── entry.client.tsx             # Client entry point
│
├── public/                          # Static assets
├── TESTING.md                       # Comprehensive testing checklist
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
└── package.json
```

## Architecture Overview

### File-Based Routing

React Router 7 uses file-based routing where each file in `app/routes/` becomes a route:

```
app/routes/_index.tsx          → /
app/routes/accounts._index.tsx → /accounts
app/routes/accounts.$id.tsx    → /accounts/:id
app/routes/accounts.$id.edit.tsx → /accounts/:id/edit
```

### Data Fetching Pattern

We use TanStack Query for all API interactions:

```typescript
// Custom hook in app/lib/api/hooks/use-accounts.ts
export function useAccount(id: string) {
  return useQuery({
    queryKey: ["accounts", id],
    queryFn: () => apiClient.get(`/accounts/${id}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Usage in component
const { data, isLoading, error } = useAccount(accountId);
```

### API Response Structure

All API responses follow ADR-003 standard:

```typescript
interface ApiResponse<T> {
  data: T | T[];
  paging: {
    offset: number | null;
    limit: number | null;
    total: number | null;
    totalPages: number | null;
    hasNext: boolean | null;
    hasPrev: boolean | null;
  };
}
```

### Component Patterns

#### Gradient Design Language

All detail pages use consistent gradient-themed cards:

```typescript
<Card className="overflow-hidden border-0 shadow-lg">
  {/* Gradient top border */}
  <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />

  {/* Gradient header background */}
  <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50">
    {/* Icon badge */}
    <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
      <Package className="h-6 w-6 text-white" />
    </div>
  </CardHeader>

  <CardContent>
    {/* Content with icon badges for each field */}
  </CardContent>
</Card>
```

#### Tab-Based Navigation

Consistent tab pattern across detail pages:

```typescript
<Tabs defaultValue="overview">
  <TabsList className="bg-white border shadow-sm">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>

  <TabsContent value="overview">
    {/* Overview content */}
  </TabsContent>
</Tabs>
```

#### Loading States

Skeleton loaders that match final layout:

```typescript
{isLoading ? (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Card key={i}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
) : (
  // Actual content
)}
```

### State Management

#### Server State (TanStack Query)

All API data is managed by TanStack Query:
- Automatic caching with configurable stale times
- Background refetching for fresh data
- Optimistic updates with rollback on error
- Request deduplication
- Pagination support

#### Client State (Zustand)

Global UI state managed by Zustand:
- Sidebar open/closed state
- Theme preferences (future)
- User authentication state
- Toast notifications

### Form Handling

React Hook Form + Zod for type-safe validation:

```typescript
const schema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  primaryContactEmail: z.string().email("Invalid email address"),
  creditLimit: z.number().optional(),
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { /* ... */ },
});

const onSubmit = async (data) => {
  await createAccountMutation.mutateAsync(data);
};
```

## API Integration

### Base URL Configuration

The API client connects to the backend using `VITE_API_URL` environment variable.

### Query Parameters (ADR-003)

All list endpoints support operator-based filtering:

```typescript
// Example: Fetch active enterprise accounts with high credit limits
useAccounts({
  "status[eq]": "active",
  "accountType[eq]": "enterprise",
  "creditLimit[gte]": "100000",
  "offset[eq]": "0",
  "limit[eq]": "20",
});
```

Supported operators: `[eq]`, `[ne]`, `[lt]`, `[lte]`, `[gt]`, `[gte]`, `[in]`, `[nin]`, `[like]`, `[null]`

### Pagination

All paginated requests use offset-based pagination:

```typescript
const { data } = useAccounts({
  "offset[eq]": (page - 1) * 20,
  "limit[eq]": "20",
});

const accounts = data?.data.data; // Account array
const paging = data?.data.paging; // Pagination metadata
```

## Building for Production

### Create Production Build

```bash
# From frontend directory
npm run build

# Or from monorepo root
npm run build:frontend
```

This creates optimized bundles in `build/`:
- `build/client/` - Static assets (HTML, CSS, JS)
- `build/server/` - Server-side code

### Preview Production Build

```bash
npm run start
```

## Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t revenue-frontend .

# Run container
docker run -p 3000:3000 -e VITE_API_URL=https://api.example.com revenue-frontend
```

### Platform Deployment

The application can be deployed to any Node.js hosting platform:

- **Vercel** - Zero-config deployment
- **Netlify** - Supports React Router SSR
- **Fly.io** - Docker-based deployment
- **Railway** - Git-based deployment
- **AWS ECS** - Container deployment
- **Google Cloud Run** - Serverless containers

### Environment Variables

Set the following environment variables in production:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME="Revenova"
NODE_ENV=production
```

## Testing

We use a comprehensive manual testing checklist. See [TESTING.md](./TESTING.md) for:

- Module-by-module testing scenarios (Accounts, Contracts, Products, Invoices, Billing, Dashboard)
- UI component testing (Loading states, empty states, error states, forms, tables)
- Responsive design testing (Desktop, tablet, mobile)
- Accessibility testing (Keyboard navigation, screen readers)
- Browser compatibility testing (Chrome, Firefox, Safari, Edge)
- Edge case testing (Empty data, large data, invalid data, network issues)
- Test results tracking table

### Running Tests

Manual testing workflow:

1. Start backend with test data: `npm run generate-data:clean`
2. Start frontend: `npm run dev`
3. Open TESTING.md and follow the checklist
4. Document results in the test results table

## Performance Optimizations

### Code Splitting

- Lazy-loaded routes with React.lazy (future enhancement)
- Dynamic imports for heavy components

### Query Optimization

- TanStack Query caching (5-minute stale time for stable data)
- Prefetch data on hover for smoother navigation
- Optimistic updates for instant feedback

### Bundle Size

- Tree-shaking with Vite
- Lazy load charts/visualizations (future)
- Lightweight date library (date-fns vs moment.js)

### UI Performance

- Virtualized tables for large datasets (future)
- Debounced search inputs
- Memoized expensive calculations
- Skeleton loaders prevent layout shift

## Security Considerations

### Authentication

- Session tokens stored in httpOnly cookies (handled by backend)
- Automatic redirect to login on 401 responses
- Session expiration handling

### Input Validation

- Client-side validation with Zod (mirrors backend DTOs)
- Sanitize user inputs
- Prevent XSS attacks with React's built-in protections

### API Security

- CORS configuration on backend
- CSRF protection (if applicable)
- Rate limiting awareness

## Troubleshooting

### Common Issues

**Backend Connection Refused:**
```bash
# Ensure backend is running on port 5177
cd packages/revenue-backend
npm run dev
```

**No Test Data:**
```bash
# Generate test data
cd packages/revenue-backend
npm run generate-data:clean
```

**Port Already in Use:**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
PORT=5174 npm run dev
```

**TypeScript Errors:**
```bash
# Rebuild types
npm run typecheck
```

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow React Router conventions
- Use shadcn/ui components (don't create custom equivalents)
- Apply gradient design language for new detail pages
- Use TanStack Query for all API calls (no direct fetch)
- Use Zustand for global UI state only (not API data)

### Component Guidelines

1. **Keep components focused** - Single responsibility
2. **Extract reusable logic** - Custom hooks for common patterns
3. **Use shadcn/ui first** - Don't reinvent the wheel
4. **Follow naming conventions** - PascalCase for components, camelCase for functions
5. **Add loading states** - Always handle loading/error/empty states
6. **Type everything** - No implicit `any` types

### Pull Request Process

1. Create feature branch from `master`
2. Make changes following code style
3. Test manually using TESTING.md checklist
4. Update documentation if needed
5. Commit with descriptive messages
6. Create PR with clear description

## Related Documentation

- [Backend README](../revenue-backend/README.md) - API setup and endpoints
- [Feature Specification](../../docs/feature-spec.md) - Complete 141-task implementation plan
- [ADR-003](../../docs/adrs/003-rest-api-response-structure.md) - API response structure standard
- [Accounts API](../../docs/features/accounts.md) - Accounts API documentation
- [Contracts API](../../docs/features/contracts.md) - Contracts API documentation
- [Products API](../../docs/features/products.md) - Products API documentation
- [Invoices API](../../docs/features/invoices.md) - Invoices API documentation
- [Billing API](../../docs/features/billing.md) - Billing engine documentation
- [Hierarchical Accounts](../../docs/features/hierarchical-accounts.md) - Phase 3 documentation

## Future Enhancements

### Phase 4-5 Features

- Real-time updates with WebSockets (contract status changes, invoice payments)
- Advanced analytics dashboard (ARR, MRR, churn, customer health)
- Bulk operations (bulk invoice generation, bulk status updates)
- Export functionality (CSV, PDF for invoices/reports)
- Custom reporting and filtering
- Role-based access control (RBAC) UI
- Purchase order workflows
- Payment processing integration
- Credit management UI

### UX Enhancements

- Dark mode support
- Multi-language support (i18n)
- Keyboard shortcuts for power users
- Advanced search with filters
- Data visualization charts (revenue trends, contract distribution)
- Notification center
- Activity feed

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- Create an issue in the GitHub repository
- Contact the development team
- See troubleshooting section above

---

Built with React Router 7, TanStack Query, shadcn/ui, and Tailwind CSS.
