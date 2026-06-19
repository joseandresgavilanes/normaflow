import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient, type Role } from "@prisma/client";

export const LIVE_STATE_PATH = path.join(process.cwd(), "test-results-live", "live-fixture.json");

export type LiveActor = {
  authId: string;
  userId: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  documentId: string;
  documentTitle: string;
  notificationId: string;
  notificationTitle: string;
  invoiceNumber: string;
  reportFileName: string;
};

export type LiveFixtureState = {
  runId: string;
  actorA: LiveActor;
  actorB: LiveActor;
  storagePaths: string[];
};

function required(name: string) {
  const value = process.env[name];
  if (!value || value.includes("...") || value.includes("xxxxxxxx") || value.includes("[PASSWORD]")) {
    throw new Error(`La suite live requiere ${name} configurado con un valor real.`);
  }
  return value;
}

export function liveEnvironment() {
  if (process.env.LIVE_TEST_ALLOW_MUTATIONS !== "true") {
    throw new Error("La suite live modifica Supabase temporalmente. Ejecútala con LIVE_TEST_ALLOW_MUTATIONS=true.");
  }
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function adminClient() {
  const env = liveEnvironment();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function actorClient(actor: LiveActor): Promise<SupabaseClient> {
  const env = liveEnvironment();
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (error) throw error;
  return client;
}

export function readLiveState(): LiveFixtureState {
  return JSON.parse(fs.readFileSync(LIVE_STATE_PATH, "utf8")) as LiveFixtureState;
}

export function writeLiveState(state: LiveFixtureState) {
  fs.mkdirSync(path.dirname(LIVE_STATE_PATH), { recursive: true });
  fs.writeFileSync(LIVE_STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export async function cleanupLiveFixture(state: LiveFixtureState, prisma = new PrismaClient()) {
  const admin = adminClient();
  await admin.storage.from("documents").remove(state.storagePaths).catch(() => undefined);
  await prisma.organization.deleteMany({ where: { id: { in: [state.actorA.organizationId, state.actorB.organizationId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [state.actorA.userId, state.actorB.userId] } } });
  await Promise.allSettled([
    admin.auth.admin.deleteUser(state.actorA.authId),
    admin.auth.admin.deleteUser(state.actorB.authId),
  ]);
  await prisma.$disconnect();
}
