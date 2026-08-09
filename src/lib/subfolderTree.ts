import type { SubfolderWithResources } from "@/lib/actions/recruitment";

export type SubfolderNode = SubfolderWithResources & {
  children: SubfolderNode[];
};

/**
 * Converts a flat subfolder array into a sorted tree.
 * Subfolders whose parent_id points to an unknown id are treated as roots.
 */
export function buildSubfolderTree(
  subfolders: SubfolderWithResources[]
): SubfolderNode[] {
  const map = new Map<string, SubfolderNode>();
  for (const sf of subfolders) {
    map.set(sf.id, { ...sf, children: [] });
  }

  const roots: SubfolderNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortLevel(nodes: SubfolderNode[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const n of nodes) sortLevel(n.children);
  }
  sortLevel(roots);

  return roots;
}
