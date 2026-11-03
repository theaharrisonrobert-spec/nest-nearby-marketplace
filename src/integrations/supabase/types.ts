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
          id: string
          image_url: string | null
          is_sample: boolean
          landmarks: string | null
          negotiable: boolean
          owner_id: string | null
          price: number
          price_period: string
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
          id?: string
          image_url?: string | null
          is_sample?: boolean
          landmarks?: string | null
          negotiable?: boolean
          owner_id?: string | null
          price: number
          price_period?: string
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
          id?: string
          image_url?: string | null
          is_sample?: boolean
          landmarks?: string | null
          negotiable?: boolean
          owner_id?: string | null
          price?: number
          price_period?: string
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
          agency_name: string | null
          agency_verified: boolean
          created_at: string
          full_name: string | null
          id: string
          id_document_path: string | null
          id_number: string | null
          id_type: string | null
          phone: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          account_type?: string
          agency_name?: string | null
          agency_verified?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          id_document_path?: string | null
          id_number?: string | null
          id_type?: string | null
          phone?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          account_type?: string
          agency_name?: string | null
          agency_verified?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          id_document_path?: string | null
          id_number?: string | null
          id_type?: string | null
          phone?: string | null
          verification_status?: string
          verified_at?: string | null
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
          note: string | null
          owner_id: string
          proposed_at: string | null
          requested_at: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          note?: string | null
          owner_id: string
          proposed_at?: string | null
          requested_at: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          note?: string | null
          owner_id?: string
          proposed_at?: string | null
          requested_at?: string
          requester_id?: string
          status?: string
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
      owner_badges: {
        Args: { _owner: string }
        Returns: {
          account_type: string
          agency_name: string
          agency_verified: boolean
          identity_verified: boolean
        }[]
      }
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
