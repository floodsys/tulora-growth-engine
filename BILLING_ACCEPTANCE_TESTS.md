# Billing System Acceptance Tests

## Prerequisites

1. **Stripe Test Mode**: Ensure your Stripe account is in test mode
2. **Test Card**: Use Stripe test card `4242 4242 4242 4242` with any future expiry
3. **Webhook**: Verify webhook points to `org-billing-webhook` function
4. **Authentication**: Be logged in with an organization membership

## Test 1: Checkout Flow

### Steps:
1. Navigate to `/dashboard` (Usage & Billing section)
2. In the **Billing Test Panel**, click "Test Monthly Checkout" or "Test Yearly Checkout"
3. Complete checkout using test card `4242 4242 4242 4242`
4. Use any future expiry date (e.g., 12/25)
5. Use any 3-digit CVC (e.g., 123)

### Expected Results:
- ✅ New row appears in `org_subscriptions` table
- ✅ `organizations.billing_status` becomes `active` or `trialing`
- ✅ `organizations.current_period_end` gets populated
- ✅ `organizations.entitlements` contains price metadata
- ✅ UI shows "Pro Plan" badge
- ✅ Test Panel shows updated status

### Verification Queries:
```sql
-- Check subscription record
SELECT * FROM org_subscriptions WHERE org_id = 'your-org-id';

-- Check organization billing status
SELECT billing_status, billing_tier, current_period_end, entitlements 
FROM organizations WHERE id = 'your-org-id';
```

## Test 2: Seat Sync

### Steps:
1. **Add Member Test**:
   - Go to Team Management
   - Add a new team member
   - Observe automatic seat sync

2. **Manual Sync Test**:
   - Click "Sync Seats" button in Usage & Billing
   - Check console logs for sync completion

3. **Remove Member Test**:
   - Remove or deactivate a team member
   - Verify quantity decreases

### Expected Results:
- ✅ `org-update-seats` function executes successfully
- ✅ Stripe subscription quantity updates
- ✅ `org_subscriptions.quantity` matches Stripe
- ✅ Toast notification confirms sync

### Verification:
- Check console logs for "Seat sync success" messages
- Verify Stripe dashboard shows updated quantity
- Confirm database quantity matches actual active seats

## Test 3: Customer Portal Changes

### Steps:
1. Click "Manage Subscription" button (only visible for active subscriptions)
2. In Stripe Customer Portal:
   - Change plan (upgrade/downgrade)
   - OR cancel subscription
   - OR update payment method
3. Return to application
4. Click "Refresh Status" or wait for automatic refresh

### Expected Results:
- ✅ Webhook receives plan change events
- ✅ Database reflects new subscription state
- ✅ `check-org-billing` returns updated information
- ✅ UI shows new plan status
- ✅ Entitlements update accordingly

### Verification:
- Check webhook logs in Supabase Functions
- Verify database has latest subscription data
- Confirm UI reflects changes within 30 seconds

## Test 4: UI Guardrails & Paywall

### Steps:
1. **Test Inactive State**:
   - Cancel subscription via Customer Portal
   - OR use organization without active subscription
   - Navigate through the application

2. **Expected Paywall Behavior**:
   - Usage & Billing shows "Upgrade Required" card
   - Feature restrictions are enforced
   - Upgrade CTAs are prominent

### Expected Results:
- ✅ Non-active/trialing users see paywall messaging
- ✅ "Upgrade Required" card displays with warning icon
- ✅ Badge shows "Free Plan" instead of "Pro Plan"
- ✅ Gated features show upgrade prompts
- ✅ Monthly/Yearly upgrade buttons work

## Development Tools

### Billing Test Panel
The yellow test panel at the top provides:
- Real-time billing status display
- One-click test checkout buttons
- Debug information with full billing object
- Manual refresh capability

### Console Monitoring
Monitor these logs during testing:
```javascript
// Check for these console messages:
"[CHECK-ORG-BILLING] Function started"
"[ORG-BILLING-WEBHOOK] Event verified"
"Seat sync success"
"Billing status response"
```

### Database Monitoring
Key tables to watch:
- `org_subscriptions` - Subscription details
- `organizations` - Cached billing status
- `organization_members` - Seat count source

## Troubleshooting

### Common Issues:
1. **Webhook not firing**: Check Stripe webhook configuration
2. **Billing status not updating**: Verify webhook secret matches
3. **Seat sync failing**: Check organization membership data
4. **UI not updating**: Clear cache and refresh billing status

### Debug Steps:
1. Check browser console for errors
2. Verify edge function logs in Supabase
3. Confirm webhook events in Stripe dashboard
4. Use Test Panel debug info for state inspection

## Success Criteria

All tests pass when:
- ✅ Checkout creates subscription and updates status
- ✅ Seat changes sync to Stripe automatically
- ✅ Portal changes reflect in application within 30s
- ✅ UI properly gates features based on billing status
- ✅ No console errors during any flow
- ✅ Database consistency maintained throughout