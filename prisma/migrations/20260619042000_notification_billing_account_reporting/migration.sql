CREATE TYPE public."ReportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV');

ALTER TABLE public."notifications" ADD COLUMN "readAt" TIMESTAMP(3);
UPDATE public."notifications" SET "readAt" = "createdAt" WHERE "read" = true AND "readAt" IS NULL;
CREATE INDEX "notifications_userId_read_createdAt_idx"
  ON public."notifications"("userId", "read", "createdAt");

CREATE TABLE public."billing_invoices" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "stripeInvoiceId" TEXT NOT NULL,
  "number" TEXT,
  "status" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'eur',
  "amountDue" INTEGER NOT NULL,
  "amountPaid" INTEGER NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "hostedInvoiceUrl" TEXT,
  "invoicePdf" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_invoices_stripeInvoiceId_key" ON public."billing_invoices"("stripeInvoiceId");
CREATE INDEX "billing_invoices_organizationId_createdAt_idx" ON public."billing_invoices"("organizationId", "createdAt");
CREATE INDEX "billing_invoices_subscriptionId_idx" ON public."billing_invoices"("subscriptionId");
ALTER TABLE public."billing_invoices" ADD CONSTRAINT "billing_invoices_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public."billing_invoices" ADD CONSTRAINT "billing_invoices_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES public."subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE public."report_exports" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "generatedById" TEXT,
  "reportType" TEXT NOT NULL,
  "format" public."ReportFormat" NOT NULL,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "report_exports_organizationId_createdAt_idx" ON public."report_exports"("organizationId", "createdAt");
CREATE INDEX "report_exports_generatedById_idx" ON public."report_exports"("generatedById");
ALTER TABLE public."report_exports" ADD CONSTRAINT "report_exports_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public."report_exports" ADD CONSTRAINT "report_exports_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.nf_validate_billing_invoice_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."subscriptionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."subscriptions" subscription
    WHERE subscription."id" = NEW."subscriptionId"
      AND subscription."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Billing invoice subscription must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_billing_invoice_link() FROM PUBLIC;
CREATE TRIGGER nf_billing_invoice_link
BEFORE INSERT OR UPDATE OF "organizationId", "subscriptionId" ON public."billing_invoices"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_billing_invoice_link();

CREATE OR REPLACE FUNCTION public.nf_validate_report_export_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."generatedById" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."memberships" membership
    WHERE membership."userId" = NEW."generatedById"
      AND membership."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Report author must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.nf_validate_report_export_user() FROM PUBLIC;
CREATE TRIGGER nf_report_export_user
BEFORE INSERT OR UPDATE OF "organizationId", "generatedById" ON public."report_exports"
FOR EACH ROW EXECUTE FUNCTION public.nf_validate_report_export_user();

ALTER TABLE public."billing_invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_billing_invoices_select" ON public."billing_invoices"
FOR SELECT TO authenticated
USING (public.nf_has_org_permission("organizationId", 'billing:read'));

ALTER TABLE public."report_exports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_report_exports_select" ON public."report_exports"
FOR SELECT TO authenticated
USING (public.nf_has_org_permission("organizationId", 'reporting:read'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public."billing_invoices", public."report_exports" TO authenticated;
  END IF;
END
$$;
