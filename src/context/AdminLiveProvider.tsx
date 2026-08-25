"use client";

/**
 * AdminLiveProvider — versión "live" del AdminMockProvider.
 *
 * Comparte exactamente el mismo contexto (AdminCtx + AdminMockContextValue)
 * que el provider mock, de manera que los componentes UI consumen
 * `useAdminMock()` sin diferenciar entre ambos modos.
 *
 * Lo único que cambia:
 *   - El state se hidrata desde el server (initialData prop) en vez del seed local
 *   - Cada mutación llama al server action correspondiente y luego `router.refresh()`
 *   - Los eventos de audit log NO se emiten localmente (los emiten los server actions vía logAuditEvent)
 */

import React, { useMemo, useReducer, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActionType, Priority, ACPMStage as PrismaACPMStage, Role } from "@prisma/client";
import { AdminCtx, type AdminMockContextValue } from "./AdminMockStore";
import type { AdminPayload } from "@/lib/server-queries";
import * as adminA from "@/lib/actions/admin";
import * as catalogA from "@/lib/actions/catalogs";
import * as personnelA from "@/lib/actions/personnel";
import * as recordA from "@/lib/actions/records";
import { unwrapAction } from "@/lib/actions/unwrap";
import * as acpmA from "@/lib/actions/acpm";
import * as adminCatalogA from "@/lib/actions/admin-catalogs";

type State = AdminPayload;

type Action =
  | { type: "hydrate"; payload: State }
  | { type: "noop" };

function reducer(state: State, action: Action): State {
  if (action.type === "hydrate") return action.payload;
  return state;
}

export function AdminLiveProvider({
  initialData,
  currentUserId,
  children,
}: {
  initialData: AdminPayload;
  currentUserId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialData);

  // Cuando el server component re-renderiza tras un router.refresh(),
  // recibimos un nuevo `initialData` y re-hidratamos.
  useEffect(() => {
    dispatch({ type: "hydrate", payload: initialData });
  }, [initialData]);

  const refresh = () => router.refresh();

  const value = useMemo<AdminMockContextValue>(() => {
    return {
      mode: "live",
      state: {
        organization: state.organization,
        members: state.members.map((m) => ({ ...m, isSelf: m.userId === currentUserId })),
        groups: state.groups,
        catalogItems: state.catalogItems,
        positions: state.positions,
        personnel: state.personnel,
        locations: state.locations,
        retentionTimes: state.retentionTimes,
        dispositions: state.dispositions,
        archiveMethods: state.archiveMethods,
        recordTypes: state.recordTypes,
        clauses: state.clauses,
        processes: state.processes,
        records: state.records,
        recordEntries: state.recordEntries,
        acpms: state.acpms,
        acpmHistory: state.acpmHistory,
        // Activity trail vive ahora en /app/activity con su propio fetch.
        auditTrail: [],
      },

      // ─── Organization ──────────────────────────────────────
      updateOrganization: async (patch) => {
        await adminA.updateOrganizationSettings({
          name: patch.name ?? undefined,
          industry: patch.industry ?? undefined,
          country: patch.country ?? undefined,
          logoUrl: patch.logoUrl ?? undefined,
          size: patch.size ?? undefined,
          contactName: patch.contactName ?? undefined,
          contactEmail: patch.contactEmail ?? undefined,
          contactPhone: patch.contactPhone ?? undefined,
          website: patch.website ?? undefined,
          address: patch.address ?? undefined,
          standards: patch.standards?.map((standard) => standard as "ISO_9001" | "ISO_27001"),
        });
        refresh();
      },

      // ─── Positions ─────────────────────────────────────────
      createPosition: async (data) => {
        await catalogA.createSimpleCatalog("position", { name: data.name, description: data.description });
        refresh();
      },
      updatePosition: async (id, data) => {
        await catalogA.updateSimpleCatalog("position", id, { name: data.name, description: data.description });
        refresh();
      },
      deactivatePosition: async (id) => {
        await catalogA.deleteSimpleCatalog("position", id);
        refresh();
      },

      // ─── Locations ─────────────────────────────────────────
      createLocation: async (data) => {
        await catalogA.createSimpleCatalog("location", { name: data.name, description: data.description });
        refresh();
      },
      updateLocation: async (id, data) => {
        await catalogA.updateSimpleCatalog("location", id, { name: data.name, description: data.description });
        refresh();
      },
      deactivateLocation: async (id) => {
        await catalogA.deleteSimpleCatalog("location", id);
        refresh();
      },

      // ─── Dispositions ──────────────────────────────────────
      createDisposition: async (data) => {
        await catalogA.createSimpleCatalog("disposition", { name: data.name });
        refresh();
      },
      updateDisposition: async (id, data) => {
        await catalogA.updateSimpleCatalog("disposition", id, data);
        refresh();
      },
      deactivateDisposition: async (id) => {
        await catalogA.deleteSimpleCatalog("disposition", id);
        refresh();
      },

      // ─── Archive methods ───────────────────────────────────
      createArchiveMethod: async (data) => {
        await catalogA.createSimpleCatalog("archiveMethod", { name: data.name });
        refresh();
      },
      updateArchiveMethod: async (id, data) => {
        await catalogA.updateSimpleCatalog("archiveMethod", id, data);
        refresh();
      },
      deactivateArchiveMethod: async (id) => {
        await catalogA.deleteSimpleCatalog("archiveMethod", id);
        refresh();
      },

      // ─── Record types ──────────────────────────────────────
      createRecordType: async (data) => {
        await catalogA.createSimpleCatalog("recordType", { name: data.name, code: data.code });
        refresh();
      },
      updateRecordType: async (id, data) => {
        await catalogA.updateSimpleCatalog("recordType", id, data);
        refresh();
      },
      deactivateRecordType: async (id) => {
        await catalogA.deleteSimpleCatalog("recordType", id);
        refresh();
      },

      // ─── Retention ─────────────────────────────────────────
      createRetention: async (data) => {
        await catalogA.createRetentionTime({ name: data.name, months: data.months });
        refresh();
      },
      updateRetention: async (id, data) => {
        await catalogA.updateRetentionTime(id, data);
        refresh();
      },
      deactivateRetention: async (id) => {
        await catalogA.deleteRetentionTime(id);
        refresh();
      },

      // ─── Personnel ─────────────────────────────────────────
      createPersonnel: async (data) => {
        await personnelA.createPersonnel(data);
        refresh();
      },
      updatePersonnel: async (id, data) => {
        const current = state.personnel.find((p) => p.id === id);
        await personnelA.updatePersonnel(id, {
          firstName: data.firstName ?? current?.firstName ?? "",
          lastName: data.lastName ?? current?.lastName ?? "",
          email: data.email,
          identification: data.identification,
          positionId: data.positionId,
          hiredAt: data.hiredAt,
        });
        refresh();
      },
      deactivatePersonnel: async (id) => {
        await personnelA.deactivatePersonnel(id);
        refresh();
      },

      // ─── Members ───────────────────────────────────────────
      inviteMember: async (data) => {
        const outcome = await adminA.inviteMember({ email: data.email, name: data.name, role: data.role as Role });
        refresh();
        return outcome;
      },
      updateMemberRole: async (membershipId, role) => {
        await adminA.updateMemberRole(membershipId, role as Role);
        refresh();
      },
      setMemberScope: async (membershipId, scoped) => {
        await adminA.setMemberScope(membershipId, scoped);
        refresh();
      },
      removeMember: async (membershipId) => {
        await adminA.removeMember(membershipId);
        refresh();
      },
      setMemberActive: async (membershipId, active) => {
        await adminA.setMemberActive(membershipId, active);
        refresh();
      },
      resendMemberInvite: async (membershipId) => {
        const outcome = await adminA.resendMemberInvite(membershipId);
        refresh();
        return outcome;
      },

      // ─── Groups ────────────────────────────────────────────
      createGroup: async (data) => {
        await adminA.createGroup(data);
        refresh();
      },
      updateGroup: async (id, data) => {
        await adminA.updateGroup(id, data);
        refresh();
      },
      deleteGroup: async (id) => {
        await adminA.deleteGroup(id);
        refresh();
      },
      toggleGroupPermission: async (groupId, permission) => {
        const group = state.groups.find((g) => g.id === groupId);
        if (!group) return;
        const next = group.permissions.includes(permission)
          ? group.permissions.filter((p) => p !== permission)
          : [...group.permissions, permission];
        await adminA.setGroupPermissions(groupId, next);
        refresh();
      },
      toggleGroupMember: async (groupId, userId) => {
        const group = state.groups.find((g) => g.id === groupId);
        if (!group) return;
        if (group.memberIds.includes(userId)) {
          await adminA.removeGroupMember(groupId, userId);
        } else {
          await adminA.addGroupMember(groupId, userId);
        }
        refresh();
      },
      setGroupAssociations: async (groupId, processIds, modules) => {
        await adminA.setGroupAssociations({ groupId, processIds, modules });
        refresh();
      },
      createAdminCatalogItem: async (data) => {
        await adminCatalogA.createAdminCatalogItem(data as Parameters<typeof adminCatalogA.createAdminCatalogItem>[0]);
        refresh();
      },
      updateAdminCatalogItem: async (data) => {
        await adminCatalogA.updateAdminCatalogItem(data as Parameters<typeof adminCatalogA.updateAdminCatalogItem>[0]);
        refresh();
      },
      deleteAdminCatalogItem: async (id) => {
        await adminCatalogA.deleteAdminCatalogItem(id);
        refresh();
      },

      // ─── Records ───────────────────────────────────────────
      createRecord: async (data) => {
        unwrapAction(await recordA.createRecord(data));
        refresh();
      },
      updateRecord: async (id, data) => {
        const cleaned: Parameters<typeof recordA.updateRecord>[1] = {};
        if (data.code !== undefined) cleaned.code = data.code;
        if (data.name !== undefined) cleaned.name = data.name;
        if (data.processId !== undefined) cleaned.processId = data.processId ?? undefined;
        if (data.clauseId !== undefined) cleaned.clauseId = data.clauseId ?? undefined;
        if (data.recordTypeId !== undefined) cleaned.recordTypeId = data.recordTypeId ?? undefined;
        if (data.retentionTimeId !== undefined) cleaned.retentionTimeId = data.retentionTimeId ?? undefined;
        if (data.dispositionId !== undefined) cleaned.dispositionId = data.dispositionId ?? undefined;
        if (data.archiveMethodId !== undefined) cleaned.archiveMethodId = data.archiveMethodId ?? undefined;
        if (data.custodianId !== undefined) cleaned.custodianId = data.custodianId ?? undefined;
        if (data.reviewerId !== undefined) cleaned.reviewerId = data.reviewerId ?? undefined;
        if (data.physicalLocation !== undefined) cleaned.physicalLocation = data.physicalLocation ?? undefined;
        if (data.digitalLocation !== undefined) cleaned.digitalLocation = data.digitalLocation ?? undefined;
        if (data.observations !== undefined) cleaned.observations = data.observations ?? undefined;
        unwrapAction(await recordA.updateRecord(id, cleaned));
        refresh();
      },
      submitRecordForReview: async (id) => {
        unwrapAction(await recordA.submitRecordForReview(id));
        refresh();
      },
      approveRecord: async (id, comment) => {
        unwrapAction(await recordA.approveRecord(id, comment));
        refresh();
      },
      rejectRecord: async (id, comment) => {
        unwrapAction(await recordA.rejectRecord(id, comment));
        refresh();
      },
      deactivateRecord: async (id) => {
        unwrapAction(await recordA.deactivateRecord(id));
        refresh();
      },
      addRecordEntry: async (recordId, data) => {
        unwrapAction(await recordA.addRecordEntry(recordId, { ...data, title: data.title ?? data.reference ?? "Entrada" }));
        refresh();
      },
      getRecordEntryUrl: async (id) => unwrapAction(await recordA.getRecordEntryUrl(id)),
      deleteRecordEntry: async (id) => {
        unwrapAction(await recordA.deleteRecordEntry(id));
        refresh();
      },

      // ─── ACPM ──────────────────────────────────────────────
      createACPM: async (data) => {
        await acpmA.createACPM({
          title: data.title,
          description: data.description,
          type: data.type as ActionType,
          priority: data.priority as Priority,
          source: data.source,
          dueDate: data.dueDate,
          ownerId: data.ownerId,
        });
        refresh();
      },
      updateACPMFields: async (id, data) => {
        const cleaned: Parameters<typeof acpmA.updateACPMFields>[1] = {};
        if (data.title !== undefined) cleaned.title = data.title;
        if (data.description !== undefined) cleaned.description = data.description ?? undefined;
        if (data.priority !== undefined) cleaned.priority = data.priority as Priority;
        if (data.type !== undefined) cleaned.type = data.type as ActionType;
        if (data.source !== undefined) cleaned.source = data.source ?? undefined;
        if (data.rootCause !== undefined) cleaned.rootCause = data.rootCause ?? undefined;
        if (data.proposedSolution !== undefined) cleaned.proposedSolution = data.proposedSolution ?? undefined;
        if (data.effectivenessCheck !== undefined) cleaned.effectivenessCheck = data.effectivenessCheck ?? undefined;
        if (data.effectivenessAt !== undefined) cleaned.effectivenessAt = data.effectivenessAt ?? undefined;
        if (data.ownerId !== undefined) cleaned.ownerId = data.ownerId ?? undefined;
        if (data.dueDate !== undefined) cleaned.dueDate = data.dueDate ?? undefined;
        if (data.progress !== undefined) cleaned.progress = data.progress;
        await acpmA.updateACPMFields(id, cleaned);
        refresh();
      },
      transitionACPM: async (id, toStage, comment) => {
        await acpmA.transitionACPM(id, toStage as PrismaACPMStage, comment);
        refresh();
      },
      rejectACPM: async (id, comment) => {
        await acpmA.rejectACPM(id, comment);
        refresh();
      },
      commentACPM: async (id, message) => {
        await acpmA.commentACPM(id, message);
        refresh();
      },
      deleteACPM: async (id) => {
        await acpmA.deleteACPM(id);
        refresh();
      },
    };
  }, [state, currentUserId, router]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}
