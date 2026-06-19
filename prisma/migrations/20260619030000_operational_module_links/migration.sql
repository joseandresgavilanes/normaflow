-- Persist cross-module links used by Processes, Risks and Indicators.

ALTER TABLE public."indicators"
  ADD COLUMN IF NOT EXISTS "processId" TEXT;

-- Historical UI values could contain stale identifiers because these links
-- were previously session-only. Preserve valid references and clear only
-- orphaned identifiers before adding constraints.
UPDATE public."documents" AS d
SET "processId" = NULL
WHERE d."processId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public."processes" AS p WHERE p."id" = d."processId");

UPDATE public."risks" AS r
SET "processId" = NULL
WHERE r."processId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public."processes" AS p WHERE p."id" = r."processId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_processId_fkey') THEN
    ALTER TABLE public."documents"
      ADD CONSTRAINT "documents_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES public."processes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_processId_fkey') THEN
    ALTER TABLE public."risks" DROP CONSTRAINT "risks_processId_fkey";
  END IF;
  ALTER TABLE public."risks"
    ADD CONSTRAINT "risks_processId_fkey"
    FOREIGN KEY ("processId") REFERENCES public."processes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'indicators_processId_fkey') THEN
    ALTER TABLE public."indicators"
      ADD CONSTRAINT "indicators_processId_fkey"
      FOREIGN KEY ("processId") REFERENCES public."processes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "documents_processId_idx" ON public."documents"("processId");
CREATE INDEX IF NOT EXISTS "risks_processId_idx" ON public."risks"("processId");
CREATE INDEX IF NOT EXISTS "indicators_processId_idx" ON public."indicators"("processId");
