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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_issue_states: {
        Row: {
          audit_run_id: string | null
          created_at: string | null
          domain: string
          id: string
          signature: string
          state: Database["public"]["Enums"]["issue_state_enum"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audit_run_id?: string | null
          created_at?: string | null
          domain: string
          id?: string
          signature: string
          state?: Database["public"]["Enums"]["issue_state_enum"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audit_run_id?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          signature?: string
          state?: Database["public"]["Enums"]["issue_state_enum"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_issue_states_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "brand_audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_usage: {
        Row: {
          audit_count: number | null
          date: string
          domain: string
          user_id: string
        }
        Insert: {
          audit_count?: number | null
          date: string
          domain: string
          user_id: string
        }
        Update: {
          audit_count?: number | null
          date?: string
          domain?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          category: string | null
          content: string
          created_at: string | null
          excerpt: string
          featured_image: string | null
          id: string
          is_published: boolean | null
          keywords: string[] | null
          published_at: string | null
          reading_time: number | null
          slug: string
          title: string
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          author_name?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          excerpt: string
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          keywords?: string[] | null
          published_at?: string | null
          reading_time?: number | null
          slug: string
          title: string
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          author_name?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          keywords?: string[] | null
          published_at?: string | null
          reading_time?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      brand_audit_runs: {
        Row: {
          created_at: string | null
          domain: string | null
          guideline_id: string | null
          id: string
          is_preview: boolean | null
          issues_json: Json | null
          pages_scanned: number | null
          user_id: string | null
          title: string | null
          brand_name: string | null
          session_token: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          guideline_id?: string | null
          id?: string
          is_preview?: boolean | null
          issues_json?: Json | null
          pages_scanned?: number | null
          user_id?: string | null
          title?: string | null
          brand_name?: string | null
          session_token?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          guideline_id?: string | null
          id?: string
          is_preview?: boolean | null
          issues_json?: Json | null
          pages_scanned?: number | null
          user_id?: string | null
          title?: string | null
          brand_name?: string | null
          session_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_audit_runs_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_onboarding: {
        Row: {
          ab_rounds: Json | null
          brand_details: Json | null
          clarifying_answers: Json | null
          created_at: string | null
          id: string
          session_token: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          voice_profile: Json | null
        }
        Insert: {
          ab_rounds?: Json | null
          brand_details?: Json | null
          clarifying_answers?: Json | null
          created_at?: string | null
          id?: string
          session_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          voice_profile?: Json | null
        }
        Update: {
          ab_rounds?: Json | null
          brand_details?: Json | null
          clarifying_answers?: Json | null
          created_at?: string | null
          id?: string
          session_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          voice_profile?: Json | null
        }
        Relationships: []
      }
      guideline_versions: {
        Row: {
          content_md: string | null
          created_at: string | null
          guideline_id: string
          id: string
          version: number
        }
        Insert: {
          content_md?: string | null
          created_at?: string | null
          guideline_id: string
          id?: string
          version: number
        }
        Update: {
          content_md?: string | null
          created_at?: string | null
          guideline_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guideline_versions_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      guidelines: {
        Row: {
          content_md: string | null
          created_at: string | null
          id: string
          language_tag: string | null
          last_modified: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          content_md?: string | null
          created_at?: string | null
          id?: string
          language_tag?: string | null
          last_modified?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          content_md?: string | null
          created_at?: string | null
          id?: string
          language_tag?: string | null
          last_modified?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_period_end: string | null
          name: string | null
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          name?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          name?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      issue_state_enum: "active" | "ignored" | "resolved"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      issue_state_enum: ["active", "ignored", "resolved"],
    },
  },
} as const
