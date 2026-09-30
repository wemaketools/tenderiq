/** In-app paths of the organization screens (ADM-01, ADM-02, ADM-05). */
const base = '/buyer/admin/organization';

export const orgPaths = {
  home: base,
  settings: `${base}/settings`,
  structure: `${base}/structure`,
  authority: `${base}/authority`,
  committee: (committeeId: number) => `${base}/committees/${committeeId}`,
};
