# Frontend Testing Checklist

Comprehensive manual testing checklist for Revenova - Revenue Intelligence Frontend.

## Prerequisites

- ✅ Backend running on http://localhost:5177
- ✅ Frontend running on http://localhost:5173
- ✅ Test data generated (`npm run generate-data:clean`)

## Navigation & Layout

### Sidebar Navigation
- [ ] Sidebar expands/collapses correctly
- [ ] All navigation links work
- [ ] Active page indicator shows correctly
- [ ] Hover effects work on nav items
- [ ] Logo/title displays properly
- [ ] Sidebar state persists during navigation

### Page Headers
- [ ] Page titles display correctly
- [ ] Breadcrumbs work (if applicable)
- [ ] Action buttons are visible and functional
- [ ] Descriptions show relevant info

## Accounts Module

### List View (`/accounts`)
- [ ] Table loads with data
- [ ] Pagination works (next/prev buttons)
- [ ] Page indicator shows correct page number
- [ ] Loading skeleton appears while fetching
- [ ] Account names are clickable
- [ ] Account type badges display correctly
- [ ] Parent account relationships show in table
- [ ] "New Account" button navigates to form
- [ ] Empty state shows when no data

### Create Account (`/accounts/new`)
- [ ] Form loads without errors
- [ ] All fields are present and labeled
- [ ] Required field validation works
- [ ] Email validation works
- [ ] Parent account dropdown loads accounts
- [ ] Parent account dropdown prevents circular references
- [ ] Form submission creates account
- [ ] Success message/redirect happens
- [ ] Error messages display on failure
- [ ] Cancel button returns to list

### View Account (`/accounts/:id`)
- [ ] Account details load correctly
- [ ] All tabs are visible (Overview, Hierarchy, Contracts, Invoices)
- [ ] Status badge displays correctly
- [ ] Edit button navigates to edit form
- [ ] **Overview Tab:**
  - [ ] Basic information card shows all fields
  - [ ] Account type displays correctly
  - [ ] Credit limit formatted properly
  - [ ] Payment terms visible
- [ ] **Hierarchy Tab:**
  - [ ] Parent account link works (if parent exists)
  - [ ] Child accounts list displays
  - [ ] "View Full Hierarchy" button works
  - [ ] Shows correct empty state if no hierarchy
- [ ] **Contracts Tab:**
  - [ ] Contracts list loads (filtered by accountId)
  - [ ] Contract cards are clickable
  - [ ] Contract details display (number, value, seats, dates)
  - [ ] Loading state shows while fetching
  - [ ] Empty state shows when no contracts
  - [ ] "New Contract" button appears when contracts exist
- [ ] **Invoices Tab:**
  - [ ] Shows empty state (not yet implemented)
  - [ ] "Create First Invoice" button visible

### Edit Account (`/accounts/:id/edit`)
- [ ] Form loads with existing data pre-filled
- [ ] All fields are editable
- [ ] Parent account can be changed
- [ ] Form validation works
- [ ] Save button updates account
- [ ] Success message/redirect happens
- [ ] Cancel button returns to details

## Contracts Module

### List View (`/contracts`)
- [ ] Table loads with data
- [ ] Pagination works
- [ ] Contract numbers display
- [ ] Account names are clickable
- [ ] Contract values formatted as currency
- [ ] Seat counts visible
- [ ] Status badges display correctly
- [ ] Billing frequency shows
- [ ] "New Contract" button works
- [ ] Loading state shows

### Create Contract (`/contracts/new`)
- [ ] Form loads without errors
- [ ] Account dropdown loads accounts
- [ ] Date pickers work
- [ ] Number fields validate correctly
- [ ] Contract value calculation works
- [ ] Billing frequency options available
- [ ] Seat-based fields work
- [ ] Form submission creates contract
- [ ] Success redirect happens
- [ ] Error handling works

### View Contract (`/contracts/:id`)
- [ ] Contract details load correctly
- [ ] All tabs visible (Overview, Billing, Invoices)
- [ ] Status badge and date range display
- [ ] Edit button works
- [ ] **Overview Tab:**
  - [ ] Contract information card complete
  - [ ] Account link navigates correctly
  - [ ] Contract value displays
  - [ ] Start/end dates formatted
  - [ ] Seat licensing card shows (if applicable)
  - [ ] Renewal settings card displays
  - [ ] Notes section shows (if notes exist)
- [ ] **Billing Tab:**
  - [ ] Billing frequency displays
  - [ ] Payment terms show
  - [ ] Billing timing (advance/arrears) correct
- [ ] **Invoices Tab:**
  - [ ] Shows empty state
  - [ ] "Generate Invoice" button visible

### Edit Contract (`/contracts/:id/edit`)
- [ ] Form loads with existing data
- [ ] All fields editable
- [ ] Validation works
- [ ] Save updates contract
- [ ] Cancel returns to details

## Products Module

### List View (`/products`)
- [ ] Table loads with data
- [ ] Product names display
- [ ] SKUs visible
- [ ] Pricing models show
- [ ] Base prices formatted
- [ ] Active/inactive status visible
- [ ] "New Product" button works
- [ ] Pagination works

### Create Product (`/products/new`)
- [ ] Form loads
- [ ] Name and SKU fields work
- [ ] Pricing model dropdown works
- [ ] Base price field validates
- [ ] Seat configuration fields conditional
- [ ] Volume tiers editor works (for volume_tiered)
- [ ] Billing interval selector works
- [ ] Active checkbox works
- [ ] Is addon checkbox works
- [ ] Form submission creates product
- [ ] Success redirect happens

### View Product (`/products/:id`)
- [ ] Product details load
- [ ] All tabs visible (Overview, Pricing, Volume Tiers)
- [ ] Status badge displays
- [ ] Product type indicator shows
- [ ] Edit button works
- [ ] **Overview Tab:**
  - [ ] Product information card complete
  - [ ] SKU displays
  - [ ] Description shows
  - [ ] Pricing model visible
  - [ ] Seat configuration card shows (if applicable)
- [ ] **Pricing Tab:**
  - [ ] Base price displayed large
  - [ ] Currency shown
  - [ ] Billing interval displays
- [ ] **Volume Tiers Tab:**
  - [ ] Only visible for volume_tiered products
  - [ ] All tiers display correctly
  - [ ] Tier colors progress correctly
  - [ ] Quantity ranges show
  - [ ] Prices per unit formatted
  - [ ] Discount percentages calculated correctly
  - [ ] Hover effects work

### Edit Product (`/products/:id/edit`)
- [ ] Form loads with data
- [ ] All fields editable
- [ ] Save updates product
- [ ] Cancel returns to details

## Invoices Module

### List View (`/invoices`)
- [ ] Table loads (may be empty)
- [ ] Invoice numbers display
- [ ] Amounts formatted
- [ ] Status badges visible
- [ ] Due dates shown
- [ ] "New Invoice" button works
- [ ] Empty state shows if no invoices

### Other Invoice Operations
- [ ] Create invoice form works
- [ ] Invoice details view works
- [ ] Edit invoice works

## Billing Module

### Generate Invoice (`/billing/generate`)
- [ ] Form loads
- [ ] Contract dropdown loads contracts
- [ ] Generate button works
- [ ] Shows appropriate feedback

### Batch Billing (`/billing/batch`)
- [ ] Form loads
- [ ] Configuration options work
- [ ] Batch operation triggers

## Dashboard (`/`)

### Widgets
- [ ] Stats cards display (currently mock data)
- [ ] Quick actions panel visible
- [ ] All 4 action buttons work
- [ ] Recent activity timeline displays
- [ ] Activity items have icons and colors
- [ ] Visual timeline connector shows
- [ ] All links navigate correctly

## UI Components & States

### Loading States
- [ ] Skeleton loaders appear while fetching data
- [ ] Skeleton loaders match final layout
- [ ] Page loader shows for full page loads
- [ ] Loading spinner appears on buttons during submission
- [ ] Loading states don't flicker

### Empty States
- [ ] Empty states have appropriate icons
- [ ] Empty state messages are clear
- [ ] CTA buttons are present and work
- [ ] Styling is consistent

### Error States
- [ ] Form validation errors display inline
- [ ] API errors show user-friendly messages
- [ ] 404 pages show "not found" message
- [ ] Network errors are handled gracefully
- [ ] Error states have retry options where appropriate

### Forms
- [ ] Required fields are marked
- [ ] Field labels are clear
- [ ] Placeholder text is helpful
- [ ] Validation happens on blur/submit
- [ ] Error messages are specific
- [ ] Success feedback is visible
- [ ] Forms are keyboard navigable
- [ ] Tab order is logical

### Tables
- [ ] Headers are bold and clear
- [ ] Rows have hover effects
- [ ] Striped rows alternate colors
- [ ] Pagination controls work
- [ ] Page indicator shows current page
- [ ] "Previous" disabled on first page
- [ ] "Next" disabled on last page
- [ ] Loading skeleton matches table structure

### Buttons & Interactions
- [ ] Primary buttons have correct styling
- [ ] Secondary/outline buttons styled correctly
- [ ] Hover effects work (scale-105)
- [ ] Active effects work (scale-95)
- [ ] Disabled buttons have reduced opacity
- [ ] Icon alignment is correct
- [ ] Loading state shows on async actions

### Cards
- [ ] Gradient top borders display
- [ ] Header backgrounds have gradients
- [ ] Icon badges are visible and colored correctly
- [ ] Shadow effects work
- [ ] Hover effects work where applicable
- [ ] Border radius is consistent

### Status Badges
- [ ] Active status is green
- [ ] Inactive/draft status is gray
- [ ] Expired status is yellow
- [ ] Cancelled/error status is red
- [ ] Renewed status is blue
- [ ] Badge text is readable

## Responsive Design

### Desktop (1920px+)
- [ ] Layout uses full width appropriately
- [ ] Multi-column grids work
- [ ] Sidebar is expanded by default
- [ ] Tables show all columns
- [ ] Cards are well-proportioned

### Tablet (768px - 1920px)
- [ ] Layout adapts to medium screens
- [ ] Sidebar collapses appropriately
- [ ] Tables scroll horizontally if needed
- [ ] Forms stack correctly
- [ ] Navigation remains accessible

### Mobile (< 768px)
- [ ] Sidebar becomes overlay/hidden
- [ ] Tables show as cards or scroll
- [ ] Forms are single column
- [ ] Buttons are full width where appropriate
- [ ] Touch targets are adequate size

## Performance

### Initial Load
- [ ] Page loads in < 3 seconds
- [ ] No flash of unstyled content
- [ ] Fonts load correctly
- [ ] No layout shift

### Navigation
- [ ] Route changes are instant
- [ ] Data fetching is fast
- [ ] Transitions are smooth
- [ ] No unnecessary re-renders

### Data Fetching
- [ ] TanStack Query caching works
- [ ] Stale data is refetched appropriately
- [ ] Optimistic updates work
- [ ] Error retry logic works

## Accessibility

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] Skip to main content link works (if implemented)
- [ ] Escape key closes modals/dropdowns

### Screen Readers
- [ ] Alt text on images
- [ ] ARIA labels on interactive elements
- [ ] Form labels are associated
- [ ] Error messages are announced
- [ ] Status changes are announced

### Color & Contrast
- [ ] Text has sufficient contrast
- [ ] Links are distinguishable
- [ ] Status is not conveyed by color alone
- [ ] Focus indicators are visible

## Browser Compatibility

### Chrome
- [ ] All features work
- [ ] Styling is correct
- [ ] No console errors

### Firefox
- [ ] All features work
- [ ] Styling is correct
- [ ] No console errors

### Safari
- [ ] All features work
- [ ] Styling is correct
- [ ] No console errors

### Edge
- [ ] All features work
- [ ] Styling is correct
- [ ] No console errors

## Data Integrity

### CRUD Operations
- [ ] Create operations add data to list
- [ ] Read operations show correct data
- [ ] Update operations modify data correctly
- [ ] Delete operations remove data
- [ ] All operations update cache correctly

### Relationships
- [ ] Account-Contract relationships work
- [ ] Contract-Invoice relationships work
- [ ] Parent-Child account relationships work
- [ ] Hierarchical queries work correctly

### Filtering & Search
- [ ] Query parameters work
- [ ] Filters apply correctly
- [ ] Search results are accurate
- [ ] Pagination persists filters

## Edge Cases

### Empty Data
- [ ] Empty lists show appropriate state
- [ ] No contracts for account handled
- [ ] No child accounts handled
- [ ] No volume tiers handled

### Large Data
- [ ] Large lists paginate correctly
- [ ] Long text truncates/wraps appropriately
- [ ] Many children accounts handled

### Invalid Data
- [ ] Missing fields handled gracefully
- [ ] Null values don't break UI
- [ ] Invalid dates handled
- [ ] Malformed data doesn't crash app

### Network Issues
- [ ] Slow responses show loading
- [ ] Timeouts are handled
- [ ] Network errors show messages
- [ ] Retry mechanisms work

## Known Issues

Document any known issues here:

1. **Dashboard Data**: Currently uses mock data, not connected to real API
2. **Invoice Tab in Account Details**: Shows empty state, not yet implemented
3. **Old Duplicate Data**: Some duplicate accounts from previous test runs exist in database

## Test Results

| Module | Status | Tested By | Date | Notes |
|--------|--------|-----------|------|-------|
| Navigation | ⏳ Pending | - | - | - |
| Accounts List | ⏳ Pending | - | - | - |
| Accounts CRUD | ⏳ Pending | - | - | - |
| Contracts List | ⏳ Pending | - | - | - |
| Contracts CRUD | ⏳ Pending | - | - | - |
| Products List | ⏳ Pending | - | - | - |
| Products CRUD | ⏳ Pending | - | - | - |
| Dashboard | ⏳ Pending | - | - | - |
| Responsive Design | ⏳ Pending | - | - | - |
| Accessibility | ⏳ Pending | - | - | - |

---

**Testing Environment:**
- Backend Version: <git commit SHA>
- Frontend Version: <git commit SHA>
- Node Version: 20.x
- Browser: Chrome/Firefox/Safari/Edge
- Screen Resolution: 1920x1080
- Date Tested: YYYY-MM-DD

**Next Steps:**
1. Complete manual testing using this checklist
2. Document any bugs found
3. Create GitHub issues for bugs
4. Fix critical bugs before release
5. Plan for automated E2E tests (Playwright)
