import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient, type Role } from "@prisma/client";
import { getLiveTestEnvironment } from "./test-environment";

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
  processId: string;
  riskId: string;
  auditId: string;
  capaId: string;
  evidenceId: string;
  membershipId: string;
  notificationId: string;
  notificationTitle: string;
  invoiceNumber: string;
  reportFileName: string;
};

export type LiveFixtureState = {
  runId: string;
  actorA: LiveActor;
  actorB: LiveActor;
  actorAViewer: LiveActor;
  actorAAuditor: LiveActor;
  actorBAdmin: LiveActor;
  storagePaths: string[];
};

export function liveEnvironment() {
  const env = getLiveTestEnvironment();
  return { url: env.supabaseUrl, anonKey: env.supabaseAnonKey, serviceRoleKey: env.supabaseServiceRoleKey };
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
  const runUsers = await prisma.user.findMany({
    where: { email: { contains: state.runId } },
    select: { id: true, authUserId: true },
  });
  const authIds = Array.from(new Set(runUsers.map((user) => user.authUserId).filter((id): id is string => Boolean(id))));
  await admin.storage.from("documents").remove(state.storagePaths).catch(() => undefined);
  await prisma.organization.deleteMany({ where: { id: { in: [state.actorA.organizationId, state.actorB.organizationId] } } });
  await prisma.user.deleteMany({ where: { id: { in: runUsers.map((user) => user.id) } } });
  await Promise.allSettled([
    ...authIds.map((authId) => admin.auth.admin.deleteUser(authId)),
  ]);
  await prisma.$disconnect();
}
