-- Canonical live roles. Legacy role values remain in the enum so existing
-- tenants can be migrated incrementally without rewriting memberships.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';
