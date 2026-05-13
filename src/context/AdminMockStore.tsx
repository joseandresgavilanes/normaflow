"use client";

/**
 * In-memory mock store for the Phase 1.1 admin / info / catalog pages.
 *
 * Purpose: lets the stakeholder click through the new UI and validate the
 * design *before* we wire the real Prisma persistence (Phase 1.2+).
 *
 * State resets on hard refresh (this is intentional — it's a demo store).
 * Server actions in `src/lib/actions/*.ts` remain in place for the real
 * Prisma integration; this file is purely client-side.
 */

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";

// ─── Types ───────────────────────────────────────────────────────────

export type CatalogBase = { id: string; name: string; active: boolean; createdAt: string };

export type PositionRow = CatalogBase & { description: string | null };
export type LocationRow = CatalogBase & { description: string | null };
export type DispositionRow = CatalogBase;
export type ArchiveMethodRow = CatalogBase;
export type RecordTypeRow = CatalogBase;
export type RetentionTimeRow = CatalogBase & { months: number };

export type PersonnelMockRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  identification: string | null;
  positionId: string | null;
  active: boolean;
  hiredAt: string | null;
  createdAt: string;
};

export type OrgMemberMockRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "COMPLIANCE_MANAGER" | "AUDITOR" | "CONTRIBUTOR" | "VIEWER";
  createdAt: string;
  isSelf: boolean;
};

export type GroupMockRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  memberIds: string[];
  createdAt: string;
};

export type OrgSettingsMock = {
  name: string;
  industry: string | null;
  country: string;
  logoUrl: string | null;
  plan: "STARTER" | "GROWTH" | "ENTERPRISE";
};

type AdminMockState = {
  organization: OrgSettingsMock;
  members: OrgMemberMockRow[];
  groups: GroupMockRow[];
  positions: PositionRow[];
  personnel: PersonnelMockRow[];
  locations: LocationRow[];
  retentionTimes: RetentionTimeRow[];
  dispositions: DispositionRow[];
  archiveMethods: ArchiveMethodRow[];
  recordTypes: RecordTypeRow[];
};

// ─── Seed ────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const past = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function initialState(): AdminMockState {
  const adminUserId = "u-self";
  const positions: PositionRow[] = [
    { id: "pos-1", name: "Director de Calidad",      description: "Responsable del SGC.",        active: true, createdAt: past(220) },
    { id: "pos-2", name: "Auditor Interno",          description: null,                          active: true, createdAt: past(210) },
    { id: "pos-3", name: "Coordinador SGSI",         description: "Coordina ISO 27001.",         active: true, createdAt: past(180) },
    { id: "pos-4", name: "Responsable de Procesos",  description: null,                          active: true, createdAt: past(150) },
    { id: "pos-5", name: "Becario de Calidad",       description: "Cargo histórico, ya no usado.", active: false, createdAt: past(400) },
  ];

  return {
    organization: {
      name: "Tecnoserv Industrial S.A.",
      industry: "Manufactura",
      country: "ES",
      logoUrl: null,
      plan: "GROWTH",
    },
    members: [
      { membershipId: "m-1", userId: adminUserId,    name: "Ana García",     email: "ana.garcia@tecnoserv.example",   role: "ORG_ADMIN",          createdAt: past(240), isSelf: true },
      { membershipId: "m-2", userId: "u-mt",          name: "María Torres",   email: "maria.torres@tecnoserv.example", role: "COMPLIANCE_MANAGER", createdAt: past(220), isSelf: false },
      { membershipId: "m-3", userId: "u-lc",          name: "Luis Castro",    email: "luis.castro@tecnoserv.example",  role: "CONTRIBUTOR",        createdAt: past(180), isSelf: false },
      { membershipId: "m-4", userId: "u-ar",          name: "Ana Ríos",       email: "ana.rios@tecnoserv.example",     role: "AUDITOR",            createdAt: past(150), isSelf: false },
      { membershipId: "m-5", userId: "u-pg",          name: "Pedro Gómez",    email: "pedro.gomez@tecnoserv.example",  role: "VIEWER",             createdAt: past(90),  isSelf: false },
    ],
    groups: [
      {
        id: "g-1",
        name: "Auditores internos",
        description: "Equipo que ejecuta el plan anual de auditorías internas.",
        permissions: ["audits:*", "audit-program:read", "nc:create", "documents:read"],
        memberIds: ["u-mt", "u-ar"],
        createdAt: past(160),
      },
      {
        id: "g-2",
        name: "Editores documentales",
        description: "Personal autorizado a crear y revisar documentos del SGC.",
        permissions: ["documents:create", "documents:read", "records:create"],
        memberIds: ["u-mt", "u-lc"],
        createdAt: past(120),
      },
    ],
    positions,
    personnel: [
      { id: "per-1", firstName: "María",  lastName: "Torres",  email: "maria.torres@tecnoserv.example",  identification: "44.812.901-K", positionId: "pos-1", active: true,  hiredAt: past(900),  createdAt: past(900) },
      { id: "per-2", firstName: "Luis",   lastName: "Castro",  email: "luis.castro@tecnoserv.example",   identification: "29.103.554-T", positionId: "pos-4", active: true,  hiredAt: past(620),  createdAt: past(620) },
      { id: "per-3", firstName: "Ana",    lastName: "Ríos",    email: "ana.rios@tecnoserv.example",      identification: "51.992.014-B", positionId: "pos-2", active: true,  hiredAt: past(540),  createdAt: past(540) },
      { id: "per-4", firstName: "Pedro",  lastName: "Gómez",   email: "pedro.gomez@tecnoserv.example",   identification: "33.481.722-M", positionId: null,    active: true,  hiredAt: past(380),  createdAt: past(380) },
      { id: "per-5", firstName: "Carlos", lastName: "Méndez",  email: null,                                identification: "47.001.220-N", positionId: "pos-3", active: true,  hiredAt: past(260),  createdAt: past(260) },
      { id: "per-6", firstName: "Sara",   lastName: "Domingo", email: "sara.domingo@tecnoserv.example",  identification: null,            positionId: "pos-5", active: false, hiredAt: past(1100), createdAt: past(1100) },
    ],
    locations: [
      { id: "loc-1", name: "Sede Madrid",          description: "Oficina central, calle Velázquez 24.",     active: true,  createdAt: past(900) },
      { id: "loc-2", name: "Sede Barcelona",       description: "Oficina comercial, Av. Diagonal 188.",     active: true,  createdAt: past(820) },
      { id: "loc-3", name: "Planta Valencia",      description: "Centro productivo principal.",             active: true,  createdAt: past(720) },
      { id: "loc-4", name: "Servidor Corporativo", description: "Repositorio digital de documentos del SGC.", active: true,  createdAt: past(600) },
      { id: "loc-5", name: "Almacén histórico",    description: "Archivo físico cerrado en 2023.",          active: false, createdAt: past(1500) },
    ],
    retentionTimes: [
      { id: "ret-1", name: "6 meses", months: 6,   active: true, createdAt: past(900) },
      { id: "ret-2", name: "1 año",   months: 12,  active: true, createdAt: past(900) },
      { id: "ret-3", name: "3 años",  months: 36,  active: true, createdAt: past(900) },
      { id: "ret-4", name: "5 años",  months: 60,  active: true, createdAt: past(900) },
      { id: "ret-5", name: "10 años", months: 120, active: true, createdAt: past(900) },
    ],
    dispositions: [
      { id: "dis-1", name: "RECICLAR",            active: true, createdAt: past(900) },
      { id: "dis-2", name: "ELIMINAR",            active: true, createdAt: past(900) },
      { id: "dis-3", name: "ARCHIVAR HISTÓRICO",  active: true, createdAt: past(900) },
    ],
    archiveMethods: [
      { id: "arc-1", name: "Archivador físico",      active: true, createdAt: past(900) },
      { id: "arc-2", name: "Carpeta compartida",     active: true, createdAt: past(900) },
      { id: "arc-3", name: "Repositorio cifrado",    active: true, createdAt: past(900) },
      { id: "arc-4", name: "Almacén en frío",        active: true, createdAt: past(900) },
    ],
    recordTypes: [
      { id: "rt-1", name: "FÍSICO",                 active: true, createdAt: past(900) },
      { id: "rt-2", name: "ELECTRÓNICO",            active: true, createdAt: past(900) },
      { id: "rt-3", name: "FÍSICO Y ELECTRÓNICO",   active: true, createdAt: past(900) },
    ],
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────

type CatalogKey = "positions" | "locations" | "dispositions" | "archiveMethods" | "recordTypes";

type Action =
  | { type: "updateOrg"; patch: Partial<OrgSettingsMock> }
  | { type: "addCatalog"; key: CatalogKey; row: PositionRow | LocationRow | DispositionRow | ArchiveMethodRow | RecordTypeRow }
  | { type: "updateCatalog"; key: CatalogKey; id: string; patch: Record<string, unknown> }
  | { type: "deactivateCatalog"; key: CatalogKey; id: string }
  | { type: "addRetention"; row: RetentionTimeRow }
  | { type: "updateRetention"; id: string; patch: Partial<RetentionTimeRow> }
  | { type: "deactivateRetention"; id: string }
  | { type: "addPersonnel"; row: PersonnelMockRow }
  | { type: "updatePersonnel"; id: string; patch: Partial<PersonnelMockRow> }
  | { type: "deactivatePersonnel"; id: string }
  | { type: "inviteMember"; row: OrgMemberMockRow }
  | { type: "updateMemberRole"; membershipId: string; role: OrgMemberMockRow["role"] }
  | { type: "removeMember"; membershipId: string }
  | { type: "createGroup"; row: GroupMockRow }
  | { type: "updateGroup"; id: string; patch: Partial<GroupMockRow> }
  | { type: "deleteGroup"; id: string }
  | { type: "toggleGroupPermission"; groupId: string; permission: string }
  | { type: "toggleGroupMember"; groupId: string; userId: string };

function reducer(state: AdminMockState, action: Action): AdminMockState {
  switch (action.type) {
    case "updateOrg":
      return { ...state, organization: { ...state.organization, ...action.patch } };

    case "addCatalog":
      return { ...state, [action.key]: [action.row as never, ...(state[action.key] as never[])] };
    case "updateCatalog":
      return {
        ...state,
        [action.key]: (state[action.key] as Array<{ id: string }>).map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r
        ),
      };
    case "deactivateCatalog":
      return {
        ...state,
        [action.key]: (state[action.key] as Array<{ id: string; active: boolean }>).map((r) =>
          r.id === action.id ? { ...r, active: false } : r
        ),
      };

    case "addRetention":
      return { ...state, retentionTimes: [action.row, ...state.retentionTimes] };
    case "updateRetention":
      return {
        ...state,
        retentionTimes: state.retentionTimes.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case "deactivateRetention":
      return {
        ...state,
        retentionTimes: state.retentionTimes.map((r) => (r.id === action.id ? { ...r, active: false } : r)),
      };

    case "addPersonnel":
      return { ...state, personnel: [action.row, ...state.personnel] };
    case "updatePersonnel":
      return { ...state, personnel: state.personnel.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case "deactivatePersonnel":
      return { ...state, personnel: state.personnel.map((p) => (p.id === action.id ? { ...p, active: false } : p)) };

    case "inviteMember":
      return { ...state, members: [...state.members, action.row] };
    case "updateMemberRole":
      return { ...state, members: state.members.map((m) => (m.membershipId === action.membershipId ? { ...m, role: action.role } : m)) };
    case "removeMember":
      return {
        ...state,
        members: state.members.filter((m) => m.membershipId !== action.membershipId),
        groups: state.groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((uid) => state.members.find((m) => m.membershipId === action.membershipId)?.userId !== uid) })),
      };

    case "createGroup":
      return { ...state, groups: [...state.groups, action.row] };
    case "updateGroup":
      return { ...state, groups: state.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)) };
    case "deleteGroup":
      return { ...state, groups: state.groups.filter((g) => g.id !== action.id) };
    case "toggleGroupPermission":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const has = g.permissions.includes(action.permission);
          return { ...g, permissions: has ? g.permissions.filter((p) => p !== action.permission) : [...g.permissions, action.permission] };
        }),
      };
    case "toggleGroupMember":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const has = g.memberIds.includes(action.userId);
          return { ...g, memberIds: has ? g.memberIds.filter((u) => u !== action.userId) : [...g.memberIds, action.userId] };
        }),
      };
  }
}

// ─── Context ─────────────────────────────────────────────────────────

type AdminMockContextValue = {
  state: AdminMockState;
  // organization
  updateOrganization: (patch: Partial<OrgSettingsMock>) => void;
  // simple catalogs
  createPosition: (data: { name: string; description?: string }) => void;
  updatePosition: (id: string, data: { name?: string; description?: string }) => void;
  deactivatePosition: (id: string) => void;
  createLocation: (data: { name: string; description?: string }) => void;
  updateLocation: (id: string, data: { name?: string; description?: string }) => void;
  deactivateLocation: (id: string) => void;
  createDisposition: (data: { name: string }) => void;
  updateDisposition: (id: string, data: { name?: string }) => void;
  deactivateDisposition: (id: string) => void;
  createArchiveMethod: (data: { name: string }) => void;
  updateArchiveMethod: (id: string, data: { name?: string }) => void;
  deactivateArchiveMethod: (id: string) => void;
  createRecordType: (data: { name: string }) => void;
  updateRecordType: (id: string, data: { name?: string }) => void;
  deactivateRecordType: (id: string) => void;
  // retention
  createRetention: (data: { name: string; months: number }) => void;
  updateRetention: (id: string, data: { name?: string; months?: number }) => void;
  deactivateRetention: (id: string) => void;
  // personnel
  createPersonnel: (data: { firstName: string; lastName: string; email?: string; identification?: string; positionId?: string; hiredAt?: string }) => void;
  updatePersonnel: (id: string, data: { firstName?: string; lastName?: string; email?: string; identification?: string; positionId?: string; hiredAt?: string }) => void;
  deactivatePersonnel: (id: string) => void;
  // members
  inviteMember: (data: { name: string; email: string; role: OrgMemberMockRow["role"] }) => void;
  updateMemberRole: (membershipId: string, role: OrgMemberMockRow["role"]) => void;
  removeMember: (membershipId: string) => void;
  // groups
  createGroup: (data: { name: string; description?: string }) => void;
  updateGroup: (id: string, data: { name?: string; description?: string }) => void;
  deleteGroup: (id: string) => void;
  toggleGroupPermission: (groupId: string, permission: string) => void;
  toggleGroupMember: (groupId: string, userId: string) => void;
};

const Ctx = createContext<AdminMockContextValue | null>(null);

export function AdminMockProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const mkPosition = useCallback(
    (data: { name: string; description?: string }): PositionRow => ({
      id: id("pos"),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      active: true,
      createdAt: new Date().toISOString(),
    }),
    []
  );
  const mkLocation = useCallback(
    (data: { name: string; description?: string }): LocationRow => ({
      id: id("loc"),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      active: true,
      createdAt: new Date().toISOString(),
    }),
    []
  );
  const mkSimple = useCallback((prefix: string, data: { name: string }) => ({
    id: id(prefix),
    name: data.name.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  }), []);

  const value = useMemo<AdminMockContextValue>(
    () => ({
      state,
      updateOrganization: (patch) => dispatch({ type: "updateOrg", patch }),

      createPosition: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "positions", row: mkPosition(data) });
      },
      updatePosition: (id, data) =>
        dispatch({ type: "updateCatalog", key: "positions", id, patch: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        } }),
      deactivatePosition: (id) => dispatch({ type: "deactivateCatalog", key: "positions", id }),

      createLocation: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "locations", row: mkLocation(data) });
      },
      updateLocation: (id, data) =>
        dispatch({ type: "updateCatalog", key: "locations", id, patch: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        } }),
      deactivateLocation: (id) => dispatch({ type: "deactivateCatalog", key: "locations", id }),

      createDisposition: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "dispositions", row: mkSimple("dis", data) });
      },
      updateDisposition: (id, data) =>
        dispatch({ type: "updateCatalog", key: "dispositions", id, patch: data.name !== undefined ? { name: data.name.trim() } : {} }),
      deactivateDisposition: (id) => dispatch({ type: "deactivateCatalog", key: "dispositions", id }),

      createArchiveMethod: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "archiveMethods", row: mkSimple("arc", data) });
      },
      updateArchiveMethod: (id, data) =>
        dispatch({ type: "updateCatalog", key: "archiveMethods", id, patch: data.name !== undefined ? { name: data.name.trim() } : {} }),
      deactivateArchiveMethod: (id) => dispatch({ type: "deactivateCatalog", key: "archiveMethods", id }),

      createRecordType: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        dispatch({ type: "addCatalog", key: "recordTypes", row: mkSimple("rt", data) });
      },
      updateRecordType: (id, data) =>
        dispatch({ type: "updateCatalog", key: "recordTypes", id, patch: data.name !== undefined ? { name: data.name.trim() } : {} }),
      deactivateRecordType: (id) => dispatch({ type: "deactivateCatalog", key: "recordTypes", id }),

      createRetention: (data) => {
        if (!data.name.trim()) throw new Error("El nombre es obligatorio.");
        if (!Number.isFinite(data.months) || data.months < 0) throw new Error("Los meses deben ser no negativos.");
        dispatch({
          type: "addRetention",
          row: { id: id("ret"), name: data.name.trim(), months: Math.round(data.months), active: true, createdAt: new Date().toISOString() },
        });
      },
      updateRetention: (id, data) =>
        dispatch({ type: "updateRetention", id, patch: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.months !== undefined ? { months: Math.round(data.months) } : {}),
        } }),
      deactivateRetention: (id) => dispatch({ type: "deactivateRetention", id }),

      createPersonnel: (data) => {
        if (!data.firstName.trim() || !data.lastName.trim()) throw new Error("Nombre y apellido son obligatorios.");
        dispatch({
          type: "addPersonnel",
          row: {
            id: id("per"),
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            email: data.email?.trim() || null,
            identification: data.identification?.trim() || null,
            positionId: data.positionId || null,
            active: true,
            hiredAt: data.hiredAt || null,
            createdAt: new Date().toISOString(),
          },
        });
      },
      updatePersonnel: (id, data) =>
        dispatch({
          type: "updatePersonnel",
          id,
          patch: {
            ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
            ...(data.email !== undefined ? { email: data.email.trim() || null } : {}),
            ...(data.identification !== undefined ? { identification: data.identification.trim() || null } : {}),
            ...(data.positionId !== undefined ? { positionId: data.positionId || null } : {}),
            ...(data.hiredAt !== undefined ? { hiredAt: data.hiredAt || null } : {}),
          },
        }),
      deactivatePersonnel: (id) => dispatch({ type: "deactivatePersonnel", id }),

      inviteMember: (data) => {
        const email = data.email.trim().toLowerCase();
        if (!email || !data.name.trim()) throw new Error("Nombre y email son obligatorios.");
        if (state.members.some((m) => m.email.toLowerCase() === email)) {
          throw new Error("Esa persona ya pertenece a la organización.");
        }
        const userId = id("u");
        dispatch({
          type: "inviteMember",
          row: {
            membershipId: id("m"),
            userId,
            name: data.name.trim(),
            email,
            role: data.role,
            createdAt: new Date().toISOString(),
            isSelf: false,
          },
        });
      },
      updateMemberRole: (membershipId, role) => {
        const target = state.members.find((m) => m.membershipId === membershipId);
        if (!target) throw new Error("Miembro no encontrado.");
        if (target.role === "ORG_ADMIN" && role !== "ORG_ADMIN") {
          const others = state.members.filter((m) => m.membershipId !== membershipId && m.role === "ORG_ADMIN").length;
          if (others === 0) throw new Error("No puedes dejar la organización sin Admin.");
        }
        dispatch({ type: "updateMemberRole", membershipId, role });
      },
      removeMember: (membershipId) => {
        const target = state.members.find((m) => m.membershipId === membershipId);
        if (!target) throw new Error("Miembro no encontrado.");
        if (target.isSelf) throw new Error("No puedes eliminarte a ti mismo.");
        if (target.role === "ORG_ADMIN") {
          const others = state.members.filter((m) => m.membershipId !== membershipId && m.role === "ORG_ADMIN").length;
          if (others === 0) throw new Error("No puedes eliminar al último Admin.");
        }
        dispatch({ type: "removeMember", membershipId });
      },

      createGroup: (data) => {
        if (!data.name.trim()) throw new Error("El nombre del grupo es obligatorio.");
        dispatch({
          type: "createGroup",
          row: {
            id: id("g"),
            name: data.name.trim(),
            description: data.description?.trim() || null,
            permissions: [],
            memberIds: [],
            createdAt: new Date().toISOString(),
          },
        });
      },
      updateGroup: (id, data) =>
        dispatch({
          type: "updateGroup",
          id,
          patch: {
            ...(data.name !== undefined ? { name: data.name.trim() } : {}),
            ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
          },
        }),
      deleteGroup: (id) => dispatch({ type: "deleteGroup", id }),
      toggleGroupPermission: (groupId, permission) => dispatch({ type: "toggleGroupPermission", groupId, permission }),
      toggleGroupMember: (groupId, userId) => dispatch({ type: "toggleGroupMember", groupId, userId }),
    }),
    [state, mkPosition, mkLocation, mkSimple]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminMock(): AdminMockContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminMock must be used inside <AdminMockProvider>");
  return v;
}
