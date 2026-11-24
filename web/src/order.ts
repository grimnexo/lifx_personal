// Reorder visible entries without moving hidden entries out of their original slots.
export function reorderSubset<T extends { id: string }>(all: T[], ids: string[]): T[] {
  const byId = new Map(all.map((item) => [item.id, item]));
  const ordered = [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
  const selected = new Set(ordered.map((item) => item.id));
  let i = 0;
  return all.map((item) => selected.has(item.id) ? ordered[i++]! : item);
}
