"use client";

import { useCallback, useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { serializeListQuery } from "../../filters/parse";
import type { EntityMeta, ListQuery } from "../../filters/types";

/**
 * The URL is the single source of truth for a list view. Updates replace the URL (no history spam);
 * the server component re-renders with fresh rows while the controls show the new state optimistically.
 */
export function useListQuery(meta: EntityMeta, serverQuery: ListQuery) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setOptimistic] = useOptimistic(serverQuery);

  const navigate = useCallback(
    (next: ListQuery) => {
      const params = serializeListQuery(meta, next);
      startTransition(() => {
        setOptimistic(next);
        router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
      });
    },
    [meta, pathname, router, setOptimistic],
  );

  /** Patch the query; anything other than paging resets to page 1. */
  const update = useCallback(
    (patch: Partial<ListQuery>) => {
      const paging = Object.keys(patch).every((k) => k === "page");
      navigate({ ...query, ...(paging ? {} : { page: 1 }), ...patch });
    },
    [navigate, query],
  );

  return { query, update, replace: navigate, isPending };
}
