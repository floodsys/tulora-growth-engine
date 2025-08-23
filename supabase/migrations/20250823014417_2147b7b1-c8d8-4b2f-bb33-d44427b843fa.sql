-- Add the user to the test organization as owner for testing
INSERT INTO public.organization_members (org_id, user_id, role, seat_active) 
VALUES (
  '8ed6b425-57ad-4b5c-9618-747264d6c4f9',
  'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b', 
  'owner',
  true
) ON CONFLICT (org_id, user_id) DO NOTHING;

-- Also add a membership record for consistency
INSERT INTO public.memberships (organization_id, user_id, role, status)
VALUES (
  '8ed6b425-57ad-4b5c-9618-747264d6c4f9',
  'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',
  'owner', 
  'active'
) ON CONFLICT DO NOTHING;