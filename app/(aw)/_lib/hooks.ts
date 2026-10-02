"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Result<T> = { data: T | null; error: { message: string } | null };

// Runs a Supabase query when deps change. Pass `null` as the query to skip (for example while signed out).
export function useQuery<T>(query: (() => PromiseLike<Result<T>>) | null, deps: unknown[]) {
  // idle: the state belongs to a skipped query. A query that was just switched on counts as loading from its very
  // first render, so a list never flashes "nothing found" before its first answer.
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; idle: boolean }>({
    data: null,
    error: null,
    loading: query !== null,
    idle: query === null,
  });
  const [tick, setTick] = useState(0);
  const skip = query === null;

  useEffect(() => {
    if (!query) {
      setState({ data: null, error: null, loading: false, idle: true });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, idle: false }));
    Promise.resolve(query()).then(
      ({ data, error }) => {
        if (error) console.error("[useQuery]", error.message);
        if (alive) setState({ data, error: error?.message ?? null, loading: false, idle: false });
      },
      (e) => alive && setState({ data: null, error: String(e?.message ?? e), loading: false, idle: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, skip]);

  const reload = useCallback(() => setTick((t) => t + 1), []); // stable, so it can sit in an effect's deps
  return { data: state.data, error: state.error, loading: state.loading || (!skip && state.idle), reload };
}

export function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// Filters that live in the URL, so a search survives Back and can be shared as a link.
// `params` holds the current filters and `setFilter` merges changes into the URL. The keyword box is typed locally
// (`q`) and written to ?q= once typing pauses (`term`); a URL changed from outside (Back, a menu link) flows back in.
export function useUrlFilters(path: string) {
  const router = useRouter();
  const params = useSearchParams();
  const setFilter = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
      const query = next.toString();
      router.replace(query ? `${path}?${query}` : path, { scroll: false });
    },
    [router, params, path],
  );

  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const term = useDebounced(q);
  const wrote = useRef(urlQ); // the keyword this hook last put in (or took from) the URL
  useEffect(() => {
    if (term === wrote.current) return;
    wrote.current = term;
    setFilter({ q: term || null });
  }, [term, setFilter]);
  useEffect(() => {
    if (urlQ === wrote.current) return;
    wrote.current = urlQ;
    setQ(urlQ);
  }, [urlQ]);

  return { params, setFilter, q, setQ, term };
}
