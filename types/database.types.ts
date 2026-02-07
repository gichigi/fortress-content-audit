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
          brand_name: string | null
          brand_voice_config_snapshot: Json | null
          created_at: string | null
          domain: string | null
          guideline_id: string | null
          id: string
          is_preview: boolean | null
          issues_json: Json | null
          pages_audited: number | null
          pages_found: number | null
          scheduled_audit_id: string | null
          session_token: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          brand_name?: string | null
          brand_voice_config_snapshot?: Json | null
          created_at?: string | null
          domain?: string | null
          guideline_id?: string | null
          id?: string
          is_preview?: boolean | null
          issues_json?: Json | null
          pages_audited?: number | null
          pages_found?: number | null
          scheduled_audit_id?: string | null
          session_token?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          brand_name?: string | null
          brand_voice_config_snapshot?: Json | null
          created_at?: string | null
          domain?: string | null
          guideline_id?: string | null
          id?: string
          is_preview?: boolean | null
          issues_json?: Json | null
          pages_audited?: number | null
          pages_found?: number | null
          scheduled_audit_id?: string | null
          session_token?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_audit_runs_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_audit_runs_scheduled_audit_id_fkey"
            columns: ["scheduled_audit_id"]
            isOneToOne: false
            referencedRelation: "scheduled_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_voice_profiles: {
        Row: {
          id: string
          user_id: string
          domain: string
          enabled: boolean
          readability_level: string | null
          formality: string | null
          locale: string | null
          flag_keywords: Json | null
          ignore_keywords: Json | null
          source: string
          voice_summary: string | null
          source_domain: string | null
          source_pages: Json | null
          source_summary: string | null
          generated_at: string | null
          flag_ai_writing: boolean
          include_longform_full_audit: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          domain: string
          enabled?: boolean
          readability_level?: string | null
          formality?: string | null
          locale?: string | null
          flag_keywords?: Json | null
          ignore_keywords?: Json | null
          source?: string
          voice_summary?: string | null
          source_domain?: string | null
          source_pages?: Json | null
          source_summary?: string | null
          generated_at?: string | null
          flag_ai_writing?: boolean
          include_longform_full_audit?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          domain?: string
          enabled?: boolean
          readability_level?: string | null
          formality?: string | null
          locale?: string | null
          flag_keywords?: Json | null
          ignore_keywords?: Json | null
          source?: string
          voice_summary?: string | null
          source_domain?: string | null
          source_pages?: Json | null
          source_summary?: string | null
          generated_at?: string | null
          flag_ai_writing?: boolean
          include_longform_full_audit?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      email_captures: {
        Row: {
          abandoned_email_sent: boolean | null
          captured_at: string | null
          created_at: string | null
          email: string
          id: string
          payment_completed: boolean | null
          session_token: string
          updated_at: string | null
        }
        Insert: {
          abandoned_email_sent?: boolean | null
          captured_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          payment_completed?: boolean | null
          session_token: string
          updated_at?: string | null
        }
        Update: {
          abandoned_email_sent?: boolean | null
          captured_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          payment_completed?: boolean | null
          session_token?: string
          updated_at?: string | null
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
          brand_voice_profile_id: string | null
        }
        Insert: {
          content_md?: string | null
          created_at?: string | null
          id?: string
          language_tag?: string | null
          last_modified?: string | null
          title?: string | null
          user_id: string
          brand_voice_profile_id?: string | null
        }
        Update: {
          content_md?: string | null
          created_at?: string | null
          id?: string
          language_tag?: string | null
          last_modified?: string | null
          title?: string | null
          user_id?: string
          brand_voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guidelines_brand_voice_profile_id_fkey"
            columns: ["brand_voice_profile_id"]
            isOneToOne: false
            referencedRelation: "brand_voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          audit_id: string
          category: string | null
          created_at: string | null
          id: string
          issue_description: string
          page_url: string
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          suggested_fix: string
          updated_at: string | null
        }
        Insert: {
          audit_id: string
          category?: string | null
          created_at?: string | null
          id?: string
          issue_description: string
          page_url: string
          severity: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          suggested_fix: string
          updated_at?: string | null
        }
        Update: {
          audit_id?: string
          category?: string | null
          created_at?: string | null
          id?: string
          issue_description?: string
          page_url?: string
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          suggested_fix?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "brand_audit_runs"
            referencedColumns: ["id"]
          },
        ]
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
      scheduled_audits: {
        Row: {
          celebrated_milestones: number[] | null
          created_at: string
          domain: string
          enabled: boolean
          id: string
          last_run: string | null
          next_run: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          celebrated_milestones?: number[] | null
          created_at?: string
          domain: string
          enabled?: boolean
          id?: string
          last_run?: string | null
          next_run?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          celebrated_milestones?: number[] | null
          created_at?: string
          domain?: string
          enabled?: boolean
          id?: string
          last_run?: string | null
          next_run?: string | null
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
      issue_severity: "low" | "medium" | "high" | "critical"
      issue_status: "active" | "ignored" | "resolved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof Database
}
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
