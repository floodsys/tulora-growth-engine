-- Add missing foreign key constraint between org_stripe_subscriptions and organizations
ALTER TABLE public.org_stripe_subscriptions 
ADD CONSTRAINT fk_org_stripe_subscriptions_organization_id 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add missing foreign key constraint between org_subscriptions and organizations  
ALTER TABLE public.org_subscriptions
ADD CONSTRAINT fk_org_subscriptions_org_id
FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;