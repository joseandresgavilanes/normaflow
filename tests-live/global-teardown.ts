import fs from "node:fs";
import { cleanupLiveFixture, LIVE_STATE_PATH, readLiveState } from "./support";

export default async function globalTeardown() {
  if (!fs.existsSync(LIVE_STATE_PATH)) return;
  const state = readLiveState();
  await cleanupLiveFixture(state);
  fs.rmSync(LIVE_STATE_PATH, { force: true });
}
