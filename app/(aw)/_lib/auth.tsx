"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import type { Profile } from "./types";

type SaveKind = "business" | "peluang";

type Auth = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  // The profile could not be read (a dropped connection). Screens offer a retry instead of treating the person as new.
  failed: boolean;
  isStaff: boolean;
  // Verified by staff. This only shapes the UI; the database checks it again on every action.
  isGraduate: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  isSaved: (kind: SaveKind, id: string) => boolean;
  toggleSave: (kind: SaveKind, id: string) => Promise<boolean>; // false when the write failed
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saves, setSaves] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const shown = useRef<string | null>(null); // whose data the state above holds

  const load = useCallback(async (next: User | null) => {
    const run = ++latest.current; // a slower, older load must not overwrite a newer one (signing out mid-load)
    if (!next) {
      shown.current = null;
      setUser(null);
      setProfile(null);
      setSaves(new Set());
      setFailed(false);
      setLoading(false);
      return;
    }
    const [row, saved] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", next.id).maybeSingle(),
      supabase.from("saves").select("business_id, peluang_id"),
    ]);
    if (run !== latest.current) return;
    shown.current = next.id;
    setUser(next);
    setFailed(!!row.error);
    if (!row.error) setProfile(row.data); // on a failed read, keep what we had
    if (!saved.error) setSaves(new Set(saved.data.map((s) => (s.business_id ? `business:${s.business_id}` : `peluang:${s.peluang_id}`))));
    setLoading(false);
  }, []);

  useEffect(() => {
    // supabase-js must not be called from inside this callback, so the load is deferred a tick.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Someone else from here on (sign-in, sign-out): until their profile is in, the state still describes the previous
      // person. Say "loading" at once, or a page opened right after signing in would treat them as signed out.
      if ((session?.user.id ?? null) !== shown.current) setLoading(true);
      setTimeout(() => load(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const value = useMemo<Auth>(
    () => ({
      user,
      profile,
      loading,
      failed,
      isStaff: profile?.role === "staff",
      isGraduate: profile?.verification === "approved",
      refresh: () => load(user),
      signOut: async () => {
        await supabase.auth.signOut();
      },
      isSaved: (kind, id) => saves.has(`${kind}:${id}`),
      toggleSave: async (kind, id) => {
        if (!user) return false;
        const key = `${kind}:${id}`;
        const column = kind === "business" ? "business_id" : "peluang_id";
        const wasSaved = saves.has(key);
        // Optimistic: flip at once, roll back if the write fails.
        const flip = (on: boolean) =>
          setSaves((prev) => {
            const copy = new Set(prev);
            if (on) copy.add(key);
            else copy.delete(key);
            return copy;
          });
        flip(!wasSaved);
        const { error } = wasSaved
          ? await supabase.from("saves").delete().eq("user_id", user.id).eq(column, id)
          : await supabase
              .from("saves")
              .insert(kind === "business" ? { user_id: user.id, business_id: id } : { user_id: user.id, peluang_id: id });
        if (error) flip(wasSaved);
        return !error;
      },
    }),
    [user, profile, loading, failed, saves, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// What the server rendered: nobody signed in yet, still loading.
const PENDING: Auth = {
  user: null,
  profile: null,
  loading: true,
  failed: false,
  isStaff: false,
  isGraduate: false,
  refresh: async () => {},
  signOut: async () => {},
  isSaved: () => false,
  toggleSave: async () => false,
};
const subscribeNever = () => () => {};

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  // Parts of the page behind Suspense hydrate late, after the session has loaded. They must first render what the
  // server rendered (signed out), or React reports a hydration mismatch. False while hydrating, true right after.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return hydrated ? auth : PENDING;
}
