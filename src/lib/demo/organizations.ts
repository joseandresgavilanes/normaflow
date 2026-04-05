export type DemoOrganization = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  plan: string;
  city: string;
};

/** Simulated tenants — datos distintos por organización vía seed en WorkspaceStore */
export const DEMO_ORGANIZATIONS: DemoOrganization[] = [
  {
    id: "org_tecnoserv",
    name: "Tecnoserv Industrial S.A.",
    shortName: "Tecnoserv",
    accent: "#123C66",
    plan: "Growth",
    city: "Madrid",
  },
  {
    id: "org_logistica",
    name: "Logística Norte S.L.",
    shortName: "Logística Norte",
    accent: "#0f766e",
    plan: "Growth",
    city: "Barcelona",
  },
  {
    id: "org_iberica",
    name: "Sistemas Ibérica Tech",
    shortName: "Ibérica Tech",
    accent: "#6B3FB5",
    plan: "Starter",
    city: "Valencia",
  },
];

export function getDemoOrg(id: string): DemoOrganization | undefined {
  return DEMO_ORGANIZATIONS.find(o => o.id === id);
}
