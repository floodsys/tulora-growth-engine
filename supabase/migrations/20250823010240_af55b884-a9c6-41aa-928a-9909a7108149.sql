-- Add billing cache fields to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_status text,              -- 'trialing','active','past_due','canceled','incomplete','unpaid','incomplete_expired'
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

-- Create subscriptions table (one row per Stripe subscription)
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  product_id text,
  price_id text,
  subscription_item_id text,     -- seat item
  status text NOT NULL,
  quantity integer,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create organization_members table if missing (members = seats)
CREATE TABLE IF NOT EXISTS organization_members (
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','member')) DEFAULT 'member',
  seat_active boolean DEFAULT true,
  PRIMARY KEY (org_id, user_id)
);

-- Enable RLS on new tables
ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "org_subscriptions read for members" ON org_subscriptions;
DROP POLICY IF EXISTS "organization_members read self org" ON organization_members;

-- RLS policies for org_subscriptions - read for org members
CREATE POLICY "org_subscriptions read for members"
ON org_subscriptions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organization_members m 
  WHERE m.org_id = org_subscriptions.org_id 
  AND m.user_id = auth.uid()
));

-- RLS policies for organization_members - read self org
CREATE POLICY "organization_members read self org"
ON organization_members FOR SELECT
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM organization_members m 
    WHERE m.org_id = organization_members.org_id 
    AND m.user_id = auth.uid()
  )
);

-- Update trigger for org_subscriptions
CREATE OR REPLACE FUNCTION update_org_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_org_subscriptions_updated_at_trigger ON org_subscriptions;
CREATE TRIGGER update_org_subscriptions_updated_at_trigger
  BEFORE UPDATE ON org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_org_subscriptions_updated_at();