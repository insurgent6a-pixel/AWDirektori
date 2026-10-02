import type { Database } from "./database.types";

type Public = Database["public"];
export type Tables<T extends keyof Public["Tables"]> = Public["Tables"][T]["Row"];
export type Views<T extends keyof Public["Views"]> = Public["Views"][T]["Row"];
export type Enums<T extends keyof Public["Enums"]> = Public["Enums"][T];

export type Profile = Tables<"profiles">;

// The generator marks every view column nullable. These restate the ones that never are.
type NonNull<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
export type Peluang = NonNull<
  Views<"peluang_feed">,
  "id" | "owner_id" | "kind" | "title" | "description" | "created_at" | "owner_name" | "interested"
>;
export type EventItem = NonNull<
  Views<"event_feed">,
  "id" | "kind" | "title" | "description" | "starts_at" | "venue" | "city" | "going" | "waitlist"
>;
export type Story = NonNull<
  Views<"story_feed">,
  "id" | "title" | "body" | "created_at" | "business_a" | "name_a" | "business_b" | "name_b"
>;
export type Banner = NonNull<Views<"banner_feed">, "id" | "title" | "created_at">;
export type Graduate = NonNull<Views<"graduate_feed">, "id" | "full_name" | "programs">;

export type Loc = {
  id: string;
  label: string | null;
  address: string | null;
  city: string;
  area: string;
  mode: Enums<"location_mode">;
  lat: number;
  lng: number;
};

// A row of search_businesses(). The generator marks every column non-null, so the nullable ones are restated here.
type SearchRow = Public["Functions"]["search_businesses"]["Returns"][number];
export type Business = Omit<
  SearchRow,
  "category_other" | "service_type" | "image_path" | "batch_lp" | "batch_ib" | "batch_ia" | "perk" | "locations" | "distance_km"
> & {
  category_other: string | null;
  service_type: Enums<"service_type"> | null;
  image_path: string | null;
  batch_lp: number | null;
  batch_ib: number | null;
  batch_ia: number | null;
  perk: string | null;
  locations: Loc[];
  distance_km: number | null;
};

type ConnectionRow = Public["Functions"]["my_connections"]["Returns"][number];
export type Connection = Omit<
  ConnectionRow,
  "other_lp" | "business_id" | "business_name" | "peluang_id" | "peluang_title" | "other_phone" | "other_email" | "business_contact"
> & {
  other_lp: number | null;
  business_id: string | null;
  business_name: string | null;
  peluang_id: string | null;
  peluang_title: string | null;
  other_phone: string | null;
  other_email: string | null;
  business_contact: string | null;
};
