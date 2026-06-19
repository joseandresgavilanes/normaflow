-- Align the historical manual ISOTech migration with prisma/schema.prisma.
-- Existing installations may already have some of these corrections, so every
-- operation is conditional and preserves data.

DO $$
DECLARE
  fk RECORD;
  actual_delete TEXT;
  actual_update TEXT;
BEGIN
  FOR fk IN
    SELECT *
    FROM (VALUES
      ('documents', 'documents_locationId_fkey', 'n', 'FOREIGN KEY ("locationId") REFERENCES public."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('audits', 'audits_programId_fkey', 'n', 'FOREIGN KEY ("programId") REFERENCES public."audit_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('actions', 'actions_managementReviewId_fkey', 'n', 'FOREIGN KEY ("managementReviewId") REFERENCES public."management_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('groups', 'groups_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('group_memberships', 'group_memberships_groupId_fkey', 'c', 'FOREIGN KEY ("groupId") REFERENCES public."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('group_permissions', 'group_permissions_groupId_fkey', 'c', 'FOREIGN KEY ("groupId") REFERENCES public."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('positions', 'positions_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('personnel', 'personnel_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('personnel', 'personnel_positionId_fkey', 'n', 'FOREIGN KEY ("positionId") REFERENCES public."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('locations', 'locations_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('retention_times', 'retention_times_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('dispositions', 'dispositions_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('archive_methods', 'archive_methods_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('record_types', 'record_types_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('records', 'records_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('records', 'records_recordTypeId_fkey', 'n', 'FOREIGN KEY ("recordTypeId") REFERENCES public."record_types"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('records', 'records_retentionTimeId_fkey', 'n', 'FOREIGN KEY ("retentionTimeId") REFERENCES public."retention_times"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('records', 'records_dispositionId_fkey', 'n', 'FOREIGN KEY ("dispositionId") REFERENCES public."dispositions"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('records', 'records_archiveMethodId_fkey', 'n', 'FOREIGN KEY ("archiveMethodId") REFERENCES public."archive_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
      ('record_entries', 'record_entries_recordId_fkey', 'c', 'FOREIGN KEY ("recordId") REFERENCES public."records"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('audit_programs', 'audit_programs_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('audit_checklist_items', 'audit_checklist_items_auditId_fkey', 'c', 'FOREIGN KEY ("auditId") REFERENCES public."audits"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('management_reviews', 'management_reviews_organizationId_fkey', 'c', 'FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('management_review_inputs', 'management_review_inputs_reviewId_fkey', 'c', 'FOREIGN KEY ("reviewId") REFERENCES public."management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE'),
      ('management_review_decisions', 'management_review_decisions_reviewId_fkey', 'c', 'FOREIGN KEY ("reviewId") REFERENCES public."management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE')
    ) AS specs(table_name, constraint_name, delete_action, definition)
  LOOP
    SELECT c.confdeltype::TEXT, c.confupdtype::TEXT
      INTO actual_delete, actual_update
    FROM pg_constraint AS c
    JOIN pg_namespace AS n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
      AND c.conname = fk.constraint_name;

    IF NOT FOUND OR actual_delete <> fk.delete_action OR actual_update <> 'c' THEN
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
        fk.table_name,
        fk.constraint_name
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I %s',
        fk.table_name,
        fk.constraint_name,
        fk.definition
      );
    END IF;
  END LOOP;
END
$$;

ALTER TABLE public."documents" ALTER COLUMN "distributionList" DROP DEFAULT;
ALTER TABLE public."management_reviews" ALTER COLUMN "attendees" DROP DEFAULT;

ALTER INDEX IF EXISTS public."archive_methods_org_name_idx" RENAME TO "archive_methods_organizationId_name_key";
ALTER INDEX IF EXISTS public."audit_programs_org_year_title_idx" RENAME TO "audit_programs_organizationId_year_title_key";
ALTER INDEX IF EXISTS public."dispositions_org_name_idx" RENAME TO "dispositions_organizationId_name_key";
ALTER INDEX IF EXISTS public."group_memberships_group_user_idx" RENAME TO "group_memberships_groupId_userId_key";
ALTER INDEX IF EXISTS public."group_permissions_group_perm_idx" RENAME TO "group_permissions_groupId_permission_key";
ALTER INDEX IF EXISTS public."groups_org_name_idx" RENAME TO "groups_organizationId_name_key";
ALTER INDEX IF EXISTS public."locations_org_name_idx" RENAME TO "locations_organizationId_name_key";
ALTER INDEX IF EXISTS public."positions_org_name_idx" RENAME TO "positions_organizationId_name_key";
ALTER INDEX IF EXISTS public."record_types_org_name_idx" RENAME TO "record_types_organizationId_name_key";
ALTER INDEX IF EXISTS public."records_org_code_idx" RENAME TO "records_organizationId_code_key";
ALTER INDEX IF EXISTS public."retention_times_org_name_idx" RENAME TO "retention_times_organizationId_name_key";
ALTER INDEX IF EXISTS public."training_assignments_trigger_key" RENAME TO "training_assignments_courseId_personnelId_triggeredByDocume_key";
