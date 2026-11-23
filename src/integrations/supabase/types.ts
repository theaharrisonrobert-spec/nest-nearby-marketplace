export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string | null
          availability_status: string
          amenities: string[]
          bathrooms: number | null
          bedrooms: number | null
          category: string
          city: string
          contact_name: string | null
          contact_phone: string
          created_at: string
          description: string | null
          details_reviewed: boolean
          featured_until: string | null
          early_access_until: string | null
          id: string
          image_url: string | null
          is_sample: boolean
          landmarks: string | null
          negotiable: boolean
          owner_id: string | null
          price: number
          price_period: string
          rejection_reason: string | null
          promotion_requested: boolean
          purpose: string
          show_address: boolean
          size_sqft: number | null
          sponsored: boolean
          state: string
          status: string
          title: string
        }
        Insert: {
          address?: string | null
          availability_status?: string
          amenities?: string[]
          bathrooms?: number | null
          bedrooms?: number | null
          category: string
          city: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          description?: string | null
          details_reviewed?: boolean
          featured_until?: string | null
          early_access_until?: string | null
          id?: string
          image_url?: string | null
          is_sample?: boolean
          landmarks?: string | null
          negotiable?: boolean
          owner_id?: string | null
          price: number
          price_period?: string
          rejection_reason?: string | null
          promotion_requested?: boolean
          purpose?: string
          show_address?: boolean
          size_sqft?: number | null
          sponsored?: boolean
          state: string
          status?: string
          title: string
        }
        Update: {
          address?: string | null
          availability_status?: string
          amenities?: string[]
          bathrooms?: number | null
          bedrooms?: number | null
          category?: string
          city?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          description?: string | null
          details_reviewed?: boolean
          featured_until?: string | null
          early_access_until?: string | null
          id?: string
          image_url?: string | null
          is_sample?: boolean
          landmarks?: string | null
          negotiable?: boolean
          owner_id?: string | null
          price?: number
          price_period?: string
          rejection_reason?: string | null
          promotion_requested?: boolean
          purpose?: string
          show_address?: boolean
          size_sqft?: number | null
          sponsored?: boolean
          state?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          listing_id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          listing_id: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          listing_id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          account_review_required: boolean
          approval_status: string
          approved_at: string | null
          avatar_url: string | null
          agency_name: string | null
          agency_verified: boolean
          created_at: string
          full_name: string | null
          id: string
          id_document_path: string | null
          id_number: string | null
          id_type: string | null
          selfie_document_path: string | null
          is_blocked: boolean
          phone: string | null
          phone_verified_at: string | null
          notification_preferences: Json
          rejection_reason: string | null
          professional_type: string | null
          property_location: string | null
          property_count: string | null
          role_selected: boolean
          verification_status: string
          verification_name_matched: boolean
          verified_at: string | null
          verification_fee_paid: boolean
        }
        Insert: {
          account_type?: string
          account_review_required?: boolean
          approval_status?: string
          approved_at?: string | null
          avatar_url?: string | null
          agency_name?: string | null
          agency_verified?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          id_document_path?: string | null
          id_number?: string | null
          id_type?: string | null
          selfie_document_path?: string | null
          is_blocked?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          notification_preferences?: Json
          rejection_reason?: string | null
          professional_type?: string | null
          property_location?: string | null
          property_count?: string | null
          role_selected?: boolean
          verification_status?: string
          verification_name_matched?: boolean
          verified_at?: string | null
          verification_fee_paid?: boolean
        }
        Update: {
          account_type?: string
          account_review_required?: boolean
          approval_status?: string
          approved_at?: string | null
          avatar_url?: string | null
          agency_name?: string | null
          agency_verified?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          id_document_path?: string | null
          id_number?: string | null
          id_type?: string | null
          selfie_document_path?: string | null
          is_blocked?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          notification_preferences?: Json
          rejection_reason?: string | null
          professional_type?: string | null
          property_location?: string | null
          property_count?: string | null
          role_selected?: boolean
          verification_status?: string
          verification_name_matched?: boolean
          verified_at?: string | null
          verification_fee_paid?: boolean
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          listing_id: string
          reason: string
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id: string
          reason: string
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          contact_email: string | null
          created_at: string
          details: string
          id: string
          page_url: string | null
          resolved_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          category: string
          contact_email?: string | null
          created_at?: string
          details: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          contact_email?: string | null
          details?: string
          page_url?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          viewing_code: string | null
          note: string | null
          owner_id: string
          proposed_at: string | null
          requested_at: string
          requester_id: string
          status: string
          started_at: string | null
          landlord_completed_at: string | null
          tenant_completed_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          viewing_code?: string | null
          note?: string | null
          owner_id: string
          proposed_at?: string | null
          requested_at: string
          requester_id: string
          status?: string
          started_at?: string | null
          landlord_completed_at?: string | null
          tenant_completed_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          viewing_code?: string | null
          note?: string | null
          owner_id?: string
          proposed_at?: string | null
          requested_at?: string
          requester_id?: string
          status?: string
          started_at?: string | null
          landlord_completed_at?: string | null
          tenant_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viewings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_ratings: {
        Row: {
          created_at: string
          id: string
          landlord_polite: boolean | null
          overall_stars: number
          price_same: boolean | null
          property_real: boolean | null
          ratee_id: string
          rater_id: string
          tenant_serious: boolean | null
          tenant_showed_up: boolean | null
          viewing_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          landlord_polite?: boolean | null
          overall_stars: number
          price_same?: boolean | null
          property_real?: boolean | null
          ratee_id: string
          rater_id: string
          tenant_serious?: boolean | null
          tenant_showed_up?: boolean | null
          viewing_id: string
        }
        Update: { overall_stars?: number }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_ngn: number
          billing_email: string
          cancel_at_period_end: boolean
          created_at: string
          ends_at: string | null
          id: string
          last_charge_reference: string | null
          provider_subscription_code: string | null
          provider_subscription_token: string | null
          listing_id: string | null
          plan: string
          provider: string
          provider_reference: string
          starts_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_ngn: number
          billing_email: string
          cancel_at_period_end?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          last_charge_reference?: string | null
          provider_subscription_code?: string | null
          provider_subscription_token?: string | null
          listing_id?: string | null
          plan: string
          provider?: string
          provider_reference: string
          starts_at?: string | null
          status?: string
          user_id: string
        }
        Update: { ends_at?: string | null; starts_at?: string | null; status?: string; last_charge_reference?: string | null; cancel_at_period_end?: boolean; provider_subscription_code?: string | null; provider_subscription_token?: string | null }
        Relationships: []
      }
      tenant_subscriptions: {
        Row: {
          amount: number
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          paystack_authorization_code: string | null
          paystack_reference: string
          paystack_subscription_code: string | null
          paystack_subscription_token: string | null
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email: string
          id?: string
          paystack_authorization_code?: string | null
          paystack_reference: string
          paystack_subscription_code?: string | null
          paystack_subscription_token?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          paystack_authorization_code?: string | null
          paystack_reference?: string
          paystack_subscription_code?: string | null
          paystack_subscription_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_views: {
        Row: { created_at: string; id: string; listing_id: string; viewer_id: string | null }
        Insert: { created_at?: string; id?: string; listing_id: string; viewer_id?: string | null }
        Update: { created_at?: string; id?: string; listing_id?: string; viewer_id?: string | null }
        Relationships: []
      }
      tenant_alert_preferences: {
        Row: { user_id: string; areas: string[]; min_budget: number | null; max_budget: number | null; updated_at: string }
        Insert: { user_id: string; areas?: string[]; min_budget?: number | null; max_budget?: number | null; updated_at?: string }
        Update: { areas?: string[]; min_budget?: number | null; max_budget?: number | null; updated_at?: string }
        Relationships: []
      }
      tenant_alert_matches: {
        Row: { id: string; user_id: string; listing_id: string; created_at: string; seen_at: string | null }
        Insert: { id?: string; user_id: string; listing_id: string; created_at?: string; seen_at?: string | null }
        Update: { seen_at?: string | null }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      listing_address: { Args: { _id: string }; Returns: string }
      listing_private_details: {
        Args: { _id: string }
        Returns: {
          address: string
          contact_phone: string
        }[]
      }
      owner_badges: {
        Args: { _owner: string }
        Returns: {
          account_type: string
          agency_name: string
          agency_verified: boolean
          identity_verified: boolean
        }[]
      }
      record_sign_in: { Args: { _method?: string }; Returns: undefined }
      respond_to_viewing: { Args: { _viewing_id: string; _accept: boolean }; Returns: undefined }
      start_viewing: { Args: { _viewing_id: string }; Returns: undefined }
      complete_viewing: { Args: { _viewing_id: string }; Returns: undefined }
      user_has_active_plan: { Args: { _user_id: string; _plan: string }; Returns: boolean }
      record_listing_view: { Args: { _listing_id: string }; Returns: undefined }
      record_site_visit: { Args: Record<PropertyKey, never>; Returns: undefined }
      admin_site_visit_count: { Args: Record<PropertyKey, never>; Returns: number }
      is_verified_landlord: { Args: { _owner: string }; Returns: boolean }
      first_free_landlord_listing: { Args: { _owner: string }; Returns: string | null }
      expire_listing_features: { Args: Record<PropertyKey, never>; Returns: undefined }
      current_user_has_tenant_premium: { Args: Record<PropertyKey, never>; Returns: boolean }
      current_user_has_landlord_premium: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_verified_premium_landlord: { Args: { _owner: string }; Returns: boolean }
      premium_listing_viewers: { Args: Record<PropertyKey, never>; Returns: { listing_id: string; viewer_id: string | null; viewer_name: string | null; viewed_at: string }[] }
      profile_can_act: { Args: { _user_id: string }; Returns: boolean }
      admin_dashboard_stats: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_user_directory: { Args: { _search?: string | null }; Returns: { id: string; email: string; full_name: string | null; phone: string | null; account_type: string; approval_status: string; rejection_reason: string | null; is_blocked: boolean; created_at: string }[] }
      admin_premium_subscriptions: { Args: Record<PropertyKey, never>; Returns: { user_email: string; full_name: string | null; plan: string; status: string; amount_ngn: number; created_at: string; ends_at: string | null }[] }
      owner_listing_view_count: { Args: Record<PropertyKey, never>; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
