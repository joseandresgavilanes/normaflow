export type Role = "SUPER_ADMIN" | "ORG_ADMIN" | "COMPLIANCE_MANAGER" | "AUDITOR" | "CONTRIBUTOR" | "VIEWER";
export type Plan = "STARTER" | "GROWTH" | "ENTERPRISE";
export type DocumentStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "OBSOLETE";
export type DocumentType = "MANUAL" | "PROCEDURE" | "POLICY" | "INSTRUCTION" | "FORM" | "RECORD" | "PLAN" | "OTHER";
export type RiskStatus = "IDENTIFIED" | "UNDER_TREATMENT" | "MONITORED" | "MITIGATED" | "ACCEPTED" | "CLOSED";
export type RiskTreatment = "MITIGATE" | "ACCEPT" | "TRANSFER" | "AVOID";
export type AuditStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AuditType = "INTERNAL" | "EXTERNAL" | "CERTIFICATION" | "SURVEILLANCE";
export type NCStatus = "OPEN" | "IN_PROGRESS" | "PENDING_VALIDATION" | "CLOSED";
export type NCSeverity = "CRITICAL" | "MAJOR" | "MINOR";
export type NCSource = "INTERNAL_AUDIT" | "EXTERNAL_AUDIT" | "CUSTOMER_COMPLAINT" | "MANAGEMENT_REVIEW" | "SELF_DETECTION" | "REGULATORY";
export type ActionStatus = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "CANCELLED";
export type ActionType = "CORRECTIVE" | "PREVENTIVE" | "IMPROVEMENT";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IndicatorStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "PAUSED";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  plan: Plan;
  logoUrl?: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  organizationId: string;
}

export interface DashboardStats {
  complianceScore: number;
  iso9001Score: number;
  iso27001Score: number;
  overdueActions: number;
  criticalRisks: number;
  pendingDocuments: number;
  upcomingAudits: number;
  openNonconformities: number;
}

export interface Risk {
  id: string;
  code: string;
  title: string;
  probability: number;
  impact: number;
  score: number;
  status: RiskStatus;
  category: string;
  owner: string;
  due: string;
  control: string;
  treatment: RiskTreatment;
}

export interface Document {
  id: string;
  code: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  standard: string;
  clause: string;
  version: string;
  owner: string;
  updated: string;
  size: string;
  tags: string[];
}

export interface Audit {
  id: string;
  title: string;
  type: AuditType;
  standard: string;
  status: AuditStatus;
  date: string;
  findings: number;
  criticals: number;
  progress: number;
  auditor: string;
  scope?: string;
  objectives?: string;
}

export interface Nonconformity {
  id: string;
  code: string;
  title: string;
  source: NCSource;
  severity: NCSeverity;
  status: NCStatus;
  owner: string;
  due: string;
  rootCause: string;
  correctiveAction: string;
}

export interface Action {
  id: string;
  code: string;
  title: string;
  priority: Priority;
  status: ActionStatus;
  due: string;
  owner: string;
  source: string;
  progress: number;
  type: ActionType;
}

export interface Indicator {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: "up" | "down" | "stable";
  status: IndicatorStatus;
  period: string;
  frequency: string;
  history: number[];
  clause?: string;
}

export interface GapClause {
  clause: string;
  title: string;
  score: number;
  questions: number;
  answered: number;
  status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" | "NOT_EVALUATED";
}
