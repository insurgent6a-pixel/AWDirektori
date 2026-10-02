export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          note: string | null
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          note?: string | null
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          note?: string | null
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          active: boolean
          body: string | null
          business_id: string | null
          created_at: string
          created_by: string | null
          id: string
          image_path: string | null
          link_url: string | null
          title: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          link_url?: string | null
          title: string
        }
        Update: {
          active?: boolean
          body?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          link_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          category: string
          category_other: string | null
          consent_at: string | null
          created_at: string
          description: string
          fts: unknown
          id: string
          image_path: string | null
          links: string[]
          name: string | null
          online_only: boolean
          owner_id: string
          review_note: string | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          status: Database["public"]["Enums"]["review_status"]
          views: number
          visible: boolean | null
        }
        Insert: {
          active?: boolean
          category: string
          category_other?: string | null
          consent_at?: string | null
          created_at?: string
          description?: string
          fts?: unknown
          id?: string
          image_path?: string | null
          links?: string[]
          name?: string | null
          online_only?: boolean
          owner_id: string
          review_note?: string | null
          service_type?: Database["public"]["Enums"]["service_type"] | null
          status?: Database["public"]["Enums"]["review_status"]
          views?: number
          visible?: boolean | null
        }
        Update: {
          active?: boolean
          category?: string
          category_other?: string | null
          consent_at?: string | null
          created_at?: string
          description?: string
          fts?: unknown
          id?: string
          image_path?: string | null
          links?: string[]
          name?: string | null
          online_only?: boolean
          owner_id?: string
          review_note?: string | null
          service_type?: Database["public"]["Enums"]["service_type"] | null
          status?: Database["public"]["Enums"]["review_status"]
          views?: number
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          business_id: string | null
          created_at: string
          from_id: string
          id: string
          message: string
          peluang_id: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          to_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          from_id: string
          id?: string
          message: string
          peluang_id?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          to_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          from_id?: string
          id?: string
          message?: string
          peluang_id?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_peluang_id_fkey"
            columns: ["peluang_id"]
            isOneToOne: false
            referencedRelation: "peluang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_peluang_id_fkey"
            columns: ["peluang_id"]
            isOneToOne: false
            referencedRelation: "peluang_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_views: {
        Row: {
          business_id: string
          created_at: string
          viewer_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          viewer_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_views_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          city: string
          created_at: string
          description: string
          ends_at: string | null
          fee: string | null
          host_id: string | null
          id: string
          image_path: string | null
          kind: Database["public"]["Enums"]["event_kind"]
          review_note: string | null
          starts_at: string
          status: Database["public"]["Enums"]["review_status"]
          title: string
          venue: string
        }
        Insert: {
          capacity?: number | null
          city: string
          created_at?: string
          description?: string
          ends_at?: string | null
          fee?: string | null
          host_id?: string | null
          id?: string
          image_path?: string | null
          kind: Database["public"]["Enums"]["event_kind"]
          review_note?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["review_status"]
          title: string
          venue: string
        }
        Update: {
          capacity?: number | null
          city?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          fee?: string | null
          host_id?: string | null
          id?: string
          image_path?: string | null
          kind?: Database["public"]["Enums"]["event_kind"]
          review_note?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          area: string
          business_id: string
          city: string
          created_at: string
          geog: unknown
          id: string
          label: string | null
          lat: number
          lng: number
          mode: Database["public"]["Enums"]["location_mode"]
        }
        Insert: {
          address?: string | null
          area: string
          business_id: string
          city: string
          created_at?: string
          geog?: unknown
          id?: string
          label?: string | null
          lat: number
          lng: number
          mode?: Database["public"]["Enums"]["location_mode"]
        }
        Update: {
          address?: string | null
          area?: string
          business_id?: string
          city?: string
          created_at?: string
          geog?: unknown
          id?: string
          label?: string | null
          lat?: number
          lng?: number
          mode?: Database["public"]["Enums"]["location_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      peluang: {
        Row: {
          active: boolean
          area: string | null
          business_id: string | null
          created_at: string
          deadline: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["peluang_kind"]
          owner_id: string
          review_note: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          business_id?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          kind: Database["public"]["Enums"]["peluang_kind"]
          owner_id: string
          review_note?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title: string
        }
        Update: {
          active?: boolean
          area?: string | null
          business_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["peluang_kind"]
          owner_id?: string
          review_note?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "peluang_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peluang_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: Database["public"]["Enums"]["privacy_kind"]
          user_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["privacy_kind"]
          user_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["privacy_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          batch_ia: number | null
          batch_ib: number | null
          batch_lp: number | null
          created_at: string
          full_name: string
          id: string
          nickname: string | null
          programs: string[]
          role: Database["public"]["Enums"]["user_role"]
          verification: Database["public"]["Enums"]["verification_status"]
          verification_note: string | null
        }
        Insert: {
          batch_ia?: number | null
          batch_ib?: number | null
          batch_lp?: number | null
          created_at?: string
          full_name?: string
          id: string
          nickname?: string | null
          programs?: string[]
          role?: Database["public"]["Enums"]["user_role"]
          verification?: Database["public"]["Enums"]["verification_status"]
          verification_note?: string | null
        }
        Update: {
          batch_ia?: number | null
          batch_ib?: number | null
          batch_lp?: number | null
          created_at?: string
          full_name?: string
          id?: string
          nickname?: string | null
          programs?: string[]
          role?: Database["public"]["Enums"]["user_role"]
          verification?: Database["public"]["Enums"]["verification_status"]
          verification_note?: string | null
        }
        Relationships: []
      }
      promos: {
        Row: {
          active: boolean
          business_id: string
          code: string
          created_at: string
          id: string
          review_note: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          business_id: string
          code: string
          created_at?: string
          id?: string
          review_note?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          business_id?: string
          code?: string
          created_at?: string
          id?: string
          review_note?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          peluang_id: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          peluang_id?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          peluang_id?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_peluang_id_fkey"
            columns: ["peluang_id"]
            isOneToOne: false
            referencedRelation: "peluang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_peluang_id_fkey"
            columns: ["peluang_id"]
            isOneToOne: false
            referencedRelation: "peluang_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          created_at: string
          event_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          peluang_id: string | null
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          peluang_id?: string | null
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          peluang_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_peluang_id_fkey"
            columns: ["peluang_id"]
            isOneToOne: false
            referencedRelation: "peluang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_peluang_id_fkey"
            columns: ["peluang_id"]
            isOneToOne: false
            referencedRelation: "peluang_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          auto_approve: boolean
          auto_approve_business: boolean
          auto_approve_peluang: boolean
          auto_approve_promo: boolean
          id: boolean
        }
        Insert: {
          auto_approve?: boolean
          auto_approve_business?: boolean
          auto_approve_peluang?: boolean
          auto_approve_promo?: boolean
          id?: boolean
        }
        Update: {
          auto_approve?: boolean
          auto_approve_business?: boolean
          auto_approve_peluang?: boolean
          auto_approve_promo?: boolean
          id?: boolean
        }
        Relationships: []
      }
      stories: {
        Row: {
          agree_a: boolean
          agree_b: boolean
          body: string
          business_a: string
          business_b: string
          created_at: string
          created_by: string | null
          id: string
          image_path: string | null
          title: string
          version: string | null
        }
        Insert: {
          agree_a?: boolean
          agree_b?: boolean
          body: string
          business_a: string
          business_b: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          title: string
          version?: string | null
        }
        Update: {
          agree_a?: boolean
          agree_b?: boolean
          body?: string
          business_a?: string
          business_b?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          title?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_business_a_fkey"
            columns: ["business_a"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_business_b_fkey"
            columns: ["business_b"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      banner_feed: {
        Row: {
          body: string | null
          business_id: string | null
          created_at: string | null
          id: string | null
          image_path: string | null
          link_url: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feed: {
        Row: {
          capacity: number | null
          city: string | null
          description: string | null
          ends_at: string | null
          fee: string | null
          going: number | null
          host_lp: number | null
          host_name: string | null
          id: string | null
          image_path: string | null
          kind: Database["public"]["Enums"]["event_kind"] | null
          starts_at: string | null
          title: string | null
          venue: string | null
          waitlist: number | null
        }
        Relationships: []
      }
      peluang_feed: {
        Row: {
          area: string | null
          batch_lp: number | null
          business_id: string | null
          business_name: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string | null
          interested: number | null
          kind: Database["public"]["Enums"]["peluang_kind"] | null
          owner_id: string | null
          owner_name: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "peluang_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peluang_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_feed: {
        Row: {
          body: string | null
          business_a: string | null
          business_b: string | null
          created_at: string | null
          id: string | null
          image_path: string | null
          name_a: string | null
          name_b: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_business_a_fkey"
            columns: ["business_a"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_business_b_fkey"
            columns: ["business_b"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      audit_feed: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          actor_name: string
          created_at: string
          id: number
          note: string
          target_kind: string
          target_name: string
        }[]
      }
      cancel_rsvp: { Args: { p_event: string }; Returns: undefined }
      connect: {
        Args: { p_business?: string; p_message: string; p_peluang?: string }
        Returns: string
      }
      delete_account: { Args: { p_user: string }; Returns: undefined }
      export_user_data: { Args: { p_user: string }; Returns: Json }
      is_graduate: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      moderate: {
        Args: {
          p_action: string
          p_id: string
          p_kind: string
          p_note?: string
        }
        Returns: undefined
      }
      my_connections: {
        Args: never
        Returns: {
          business_contact: string
          business_id: string
          business_name: string
          created_at: string
          id: string
          incoming: boolean
          message: string
          other_email: string
          other_id: string
          other_lp: number
          other_name: string
          other_phone: string
          peluang_id: string
          peluang_title: string
          status: Database["public"]["Enums"]["connection_status"]
        }[]
      }
      my_phone: { Args: never; Returns: string }
      owns_business: { Args: { p_business: string }; Returns: boolean }
      promo_code: { Args: { p_business: string }; Returns: string }
      respond_connection: {
        Args: { p_action: string; p_id: string }
        Returns: undefined
      }
      rsvp: {
        Args: { p_event: string }
        Returns: Database["public"]["Enums"]["rsvp_status"]
      }
      save_profile: {
        Args: {
          p_full_name?: string
          p_ia?: number
          p_ib?: number
          p_lp?: number
          p_nickname?: string
          p_phone?: string
          p_programs?: string[]
          p_submit?: boolean
        }
        Returns: {
          batch_ia: number | null
          batch_ib: number | null
          batch_lp: number | null
          created_at: string
          full_name: string
          id: string
          nickname: string | null
          programs: string[]
          role: Database["public"]["Enums"]["user_role"]
          verification: Database["public"]["Enums"]["verification_status"]
          verification_note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_businesses: {
        Args: {
          p_area?: string
          p_category?: string
          p_city?: string
          p_ids?: string[]
          p_lat?: number
          p_lng?: number
          p_promo_only?: boolean
          p_q?: string
          p_radius_km?: number
          p_service?: Database["public"]["Enums"]["service_type"]
        }
        Returns: {
          batch_ia: number
          batch_ib: number
          batch_lp: number
          category: string
          category_other: string
          created_at: string
          description: string
          distance_km: number
          id: string
          image_path: string
          links: string[]
          locations: Json
          name: string
          online_only: boolean
          owner_id: string
          owner_name: string
          perk: string
          service_type: Database["public"]["Enums"]["service_type"]
        }[]
      }
      set_auto_approve: { Args: { p_on: boolean }; Returns: undefined }
      set_auto_approve_business: { Args: { p_on: boolean }; Returns: undefined }
      set_auto_approve_peluang: { Args: { p_on: boolean }; Returns: undefined }
      set_auto_approve_promo: { Args: { p_on: boolean }; Returns: undefined }
      set_business_contact: {
        Args: { p_business: string; p_contact: string }
        Returns: undefined
      }
      staff_overview: { Args: never; Returns: Json }
      staff_users: {
        Args: never
        Returns: {
          batch_ia: number
          batch_ib: number
          batch_lp: number
          created_at: string
          email: string
          full_name: string
          id: string
          nickname: string
          phone: string
          programs: string[]
          role: Database["public"]["Enums"]["user_role"]
          verification: Database["public"]["Enums"]["verification_status"]
          verification_note: string
        }[]
      }
      story_consent: {
        Args: { p_agree: boolean; p_story: string; p_version?: string }
        Returns: undefined
      }
      submit_business: { Args: { p_business: string }; Returns: undefined }
      track_view: { Args: { p_business: string }; Returns: undefined }
      verify_graduate: {
        Args: { p_approve: boolean; p_note?: string; p_user: string }
        Returns: undefined
      }
      view_contact: { Args: { p_business: string }; Returns: string }
    }
    Enums: {
      connection_status: "pending" | "accepted" | "declined" | "intro"
      event_kind: "meetup" | "workshop" | "gathering"
      location_mode: "exact" | "area"
      peluang_kind:
        | "supplier"
        | "partner"
        | "vendor"
        | "konsultan"
        | "freelancer"
        | "karyawan"
      privacy_kind: "export" | "delete"
      review_status: "draft" | "pending" | "approved" | "rejected" | "suspended"
      rsvp_status: "going" | "waitlist"
      service_type: "produk" | "jasa" | "keduanya"
      user_role: "member" | "staff"
      verification_status: "draft" | "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      connection_status: ["pending", "accepted", "declined", "intro"],
      event_kind: ["meetup", "workshop", "gathering"],
      location_mode: ["exact", "area"],
      peluang_kind: [
        "supplier",
        "partner",
        "vendor",
        "konsultan",
        "freelancer",
        "karyawan",
      ],
      privacy_kind: ["export", "delete"],
      review_status: ["draft", "pending", "approved", "rejected", "suspended"],
      rsvp_status: ["going", "waitlist"],
      service_type: ["produk", "jasa", "keduanya"],
      user_role: ["member", "staff"],
      verification_status: ["draft", "pending", "approved", "rejected"],
    },
  },
} as const

