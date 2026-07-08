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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_run_requests: {
        Row: {
          created_at: string
          event_url: string | null
          finished_at: string | null
          id: string
          mode: string
          note: string | null
          result: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event_url?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          note?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event_url?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          note?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      agent_updates: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          meta: Json | null
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          meta?: Json | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          meta?: Json | null
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          i_promised: string | null
          id: string
          last_interaction_at: string | null
          last_topic: string | null
          linkedin_url: string | null
          name: string
          next_followup_date: string | null
          notes: string | null
          project_id: string | null
          relationship_type: string | null
          role: string | null
          status: string | null
          suggested_followup: string | null
          they_care_about: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          i_promised?: string | null
          id?: string
          last_interaction_at?: string | null
          last_topic?: string | null
          linkedin_url?: string | null
          name: string
          next_followup_date?: string | null
          notes?: string | null
          project_id?: string | null
          relationship_type?: string | null
          role?: string | null
          status?: string | null
          suggested_followup?: string | null
          they_care_about?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          i_promised?: string | null
          id?: string
          last_interaction_at?: string | null
          last_topic?: string | null
          linkedin_url?: string | null
          name?: string
          next_followup_date?: string | null
          notes?: string | null
          project_id?: string | null
          relationship_type?: string | null
          role?: string | null
          status?: string | null
          suggested_followup?: string | null
          they_care_about?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_channels: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          phrases_avoid: string | null
          phrases_use: string | null
          project_id: string | null
          tone: string | null
          updated_at: string
          voice: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          phrases_avoid?: string | null
          phrases_use?: string | null
          project_id?: string | null
          tone?: string | null
          updated_at?: string
          voice?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          phrases_avoid?: string | null
          phrases_use?: string | null
          project_id?: string | null
          tone?: string | null
          updated_at?: string
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          ai_generated: boolean | null
          body: string
          channel_id: string | null
          created_at: string
          id: string
          posted_url: string | null
          project_id: string | null
          scheduled_at: string | null
          source_note_id: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          body: string
          channel_id?: string | null
          created_at?: string
          id?: string
          posted_url?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          source_note_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          body?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          posted_url?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          source_note_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_drafts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "content_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "source_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checklists: {
        Row: {
          created_at: string
          date: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          payload: Json
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      open_loops: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          question: string
          resolution: string | null
          source_note_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          question: string
          resolution?: string | null
          source_note_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          question?: string
          resolution?: string | null
          source_note_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_loops_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_loops_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "source_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string | null
          source_note_id: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id?: string | null
          source_note_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string | null
          source_note_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_memory_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "source_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          audience: string | null
          color: string | null
          context: string | null
          created_at: string
          description: string | null
          goals: string | null
          id: string
          name: string
          phrases_avoid: string | null
          phrases_use: string | null
          slug: string
          tone: string | null
          updated_at: string
          voice: string | null
        }
        Insert: {
          audience?: string | null
          color?: string | null
          context?: string | null
          created_at?: string
          description?: string | null
          goals?: string | null
          id?: string
          name: string
          phrases_avoid?: string | null
          phrases_use?: string | null
          slug: string
          tone?: string | null
          updated_at?: string
          voice?: string | null
        }
        Update: {
          audience?: string | null
          color?: string | null
          context?: string | null
          created_at?: string
          description?: string | null
          goals?: string | null
          id?: string
          name?: string
          phrases_avoid?: string | null
          phrases_use?: string | null
          slug?: string
          tone?: string | null
          updated_at?: string
          voice?: string | null
        }
        Relationships: []
      }
      source_notes: {
        Row: {
          ai_meta: Json | null
          classification: string | null
          created_at: string
          id: string
          processed: boolean
          project_id: string | null
          raw_text: string
          source: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          ai_meta?: Json | null
          classification?: string | null
          created_at?: string
          id?: string
          processed?: boolean
          project_id?: string | null
          raw_text: string
          source?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_meta?: Json | null
          classification?: string | null
          created_at?: string
          id?: string
          processed?: boolean
          project_id?: string | null
          raw_text?: string
          source?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          ai_generated: boolean | null
          created_at: string
          detail: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string | null
          source_note_id: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string
          detail?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          source_note_id?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string
          detail?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          source_note_id?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "source_notes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
