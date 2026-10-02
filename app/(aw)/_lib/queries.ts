// The public reads, shared by the home page and the listing pages. Each returns supabase-js's { data, error }.

import { supabase } from "./supabase";
import type { Banner, Business, Enums, EventItem, Peluang, Story } from "./types";

export type BusinessFilters = {
  q?: string;
  category?: string;
  area?: string; // an AREAS value or LUAR_JABODETABEK
  city?: string;
  service?: Enums<"service_type">;
  promoOnly?: boolean;
  near?: { lat: number; lng: number; radiusKm?: number }; // sorts by distance, and limits to the radius when given
  ids?: string[];
};

// Keyword, industry, area, city, service type, promo and distance, all in Postgres (full-text search + PostGIS).
export function searchBusinesses(f: BusinessFilters = {}) {
  return supabase
    .rpc("search_businesses", {
      p_q: f.q?.trim() || undefined,
      p_category: f.category || undefined,
      p_area: f.area || undefined,
      p_city: f.city || undefined,
      p_service: f.service || undefined,
      p_promo_only: f.promoOnly || undefined,
      p_lat: f.near?.lat,
      p_lng: f.near?.lng,
      p_radius_km: f.near?.radiusKm,
      p_ids: f.ids,
    })
    .overrideTypes<Business[], { merge: false }>();
}

// Every open Peluang, or only one person's when their id is given.
export const peluangFeed = (ownerId?: string) => {
  const query = supabase.from("peluang_feed").select("*");
  return (ownerId ? query.eq("owner_id", ownerId) : query).order("created_at", { ascending: false }).overrideTypes<Peluang[], { merge: false }>();
};

// Upcoming first. Pass `past` for events that already happened, newest first.
export const eventFeed = (past = false) => {
  const now = new Date().toISOString();
  const query = supabase.from("event_feed").select("*");
  return (past ? query.lt("starts_at", now) : query.gte("starts_at", now))
    .order("starts_at", { ascending: !past })
    .overrideTypes<EventItem[], { merge: false }>();
};

export const storyFeed = () =>
  supabase.from("story_feed").select("*").order("created_at", { ascending: false }).overrideTypes<Story[], { merge: false }>();

export const bannerFeed = () =>
  supabase.from("banner_feed").select("*").order("created_at", { ascending: false }).overrideTypes<Banner[], { merge: false }>();

// The signed-in member's RSVP per event id, in the { data, error } shape useQuery expects.
export async function myRsvps(userId: string) {
  const { data, error } = await supabase.from("rsvps").select("event_id, status").eq("user_id", userId);
  return { data: new Map((data ?? []).map((row) => [row.event_id, row.status])), error };
}
