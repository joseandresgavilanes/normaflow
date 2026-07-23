-- Align Supabase RLS with the canonical permission actions. `read` remains a
-- supported alias for existing policies and direct clients.

CREATE OR REPLACE FUNCTION public.nf_normalize_permission(requested_permission TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(requested_permission, ':', 2) = 'read'
      THEN split_part(requested_permission, ':', 1) || ':view'
    ELSE requested_permission
  END
$$;

CREATE OR REPLACE FUNCTION public.nf_role_permissions(app_role "Role")
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE app_role
    WHEN 'OWNER'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'SUPER_ADMIN'::"Role" THEN ARRAY['*']::TEXT[]
    WHEN 'ADMIN'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'org:*', 'members:*', 'groups:*',
      'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*',
      'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*',
      'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*',
      'integrations:*', 'reporting:*', 'activity:*', 'positions:*',
      'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*'
    ]::TEXT[]
    WHEN 'ORG_ADMIN'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'org:*', 'members:*', 'groups:*',
      'documents:*', 'processes:*', 'evidence:*', 'records:*', 'risks:*',
      'audits:*', 'audit-program:*', 'nc:*', 'actions:*', 'indicators:*',
      'gap:*', 'training:*', 'changes:*', 'suppliers:*', 'opportunities:*',
      'integrations:*', 'reporting:*', 'activity:*', 'positions:*',
      'personnel:*', 'locations:*', 'catalogs:*', 'mgmt-review:*', 'billing:*'
    ]::TEXT[]
    WHEN 'MANAGER'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'documents:*', 'processes:*',
      'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*',
      'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*',
      'suppliers:*', 'opportunities:*', 'integrations:view', 'reporting:*',
      'activity:view', 'positions:view', 'personnel:view', 'locations:view',
      'catalogs:view', 'mgmt-review:*', 'groups:view'
    ]::TEXT[]
    WHEN 'COMPLIANCE_MANAGER'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'documents:*', 'processes:*',
      'evidence:*', 'records:*', 'risks:*', 'audits:*', 'audit-program:*',
      'nc:*', 'actions:*', 'indicators:*', 'gap:*', 'training:*', 'changes:*',
      'suppliers:*', 'opportunities:*', 'integrations:view', 'integrations:manage',
      'reporting:*', 'activity:view', 'positions:view', 'personnel:view',
      'locations:view', 'catalogs:view', 'mgmt-review:*', 'groups:view'
    ]::TEXT[]
    WHEN 'AUDITOR'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'audits:*', 'audits:export', 'audit-program:view', 'audit-program:export',
      'nc:create', 'nc:view', 'documents:view', 'documents:approve', 'documents:export',
      'evidence:view', 'evidence:export', 'actions:view', 'actions:create', 'actions:export',
      'processes:view', 'evidence:view', 'records:view', 'records:export', 'risks:view',
      'training:view', 'changes:view', 'suppliers:view', 'opportunities:view',
      'reporting:view', 'reporting:export', 'activity:view', 'personnel:view',
      'positions:view', 'catalogs:view', 'mgmt-review:view', 'mgmt-review:export'
    ]::TEXT[]
    WHEN 'CONTRIBUTOR'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'documents:view', 'documents:create',
      'processes:view', 'risks:view', 'risks:create', 'audits:view', 'audits:create',
      'indicators:view', 'indicators:create', 'evidence:view', 'evidence:create',
      'records:view', 'records:create', 'actions:view', 'actions:create', 'actions:update',
      'nc:view', 'training:view', 'changes:view', 'suppliers:view',
      'opportunities:view', 'personnel:view', 'positions:view', 'catalogs:view'
    ]::TEXT[]
    WHEN 'VIEWER'::"Role" THEN ARRAY[
      'dashboard:view', 'notifications:view', 'documents:view', 'processes:view',
      'evidence:view', 'records:view', 'risks:view', 'audits:view',
      'indicators:view', 'training:view', 'changes:view', 'suppliers:view',
      'opportunities:view', 'reporting:view', 'activity:view', 'personnel:view',
      'positions:view', 'catalogs:view', 'mgmt-review:view'
    ]::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
$$;

CREATE OR REPLACE FUNCTION public.nf_has_org_permission(org_id TEXT, requested_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."memberships" AS m
    WHERE m."organizationId" = org_id
      AND m."userId" = public.nf_current_user_id()
      AND (
        EXISTS (
          SELECT 1
          FROM unnest(public.nf_role_permissions(m."role")) AS p(permission)
          WHERE p.permission = '*'
             OR public.nf_normalize_permission(p.permission) = public.nf_normalize_permission(requested_permission)
             OR public.nf_normalize_permission(p.permission) = split_part(public.nf_normalize_permission(requested_permission), ':', 1) || ':*'
        )
        OR EXISTS (
          SELECT 1
          FROM public."group_memberships" AS gm
          JOIN public."groups" AS g ON g."id" = gm."groupId"
          JOIN public."group_permissions" AS gp ON gp."groupId" = g."id"
          WHERE gm."userId" = m."userId"
            AND g."organizationId" = org_id
            AND gp."permission" <> '*'
            AND (
              public.nf_normalize_permission(gp."permission") = public.nf_normalize_permission(requested_permission)
              OR public.nf_normalize_permission(gp."permission") = split_part(public.nf_normalize_permission(requested_permission), ':', 1) || ':*'
            )
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.nf_normalize_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nf_has_org_permission(TEXT, TEXT) TO authenticated;
