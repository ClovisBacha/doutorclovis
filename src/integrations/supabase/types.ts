export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointment_requests: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          patient_email: string;
          patient_name: string;
          patient_phone: string;
          preferred_date: string;
          preferred_time: string;
          reason: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          patient_email: string;
          patient_name: string;
          patient_phone: string;
          preferred_date: string;
          preferred_time: string;
          reason: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          patient_email?: string;
          patient_name?: string;
          patient_phone?: string;
          preferred_date?: string;
          preferred_time?: string;
          reason?: string;
          status?: string;
        };
        Relationships: [];
      };
      checklist_items: {
        Row: {
          category: string;
          created_at: string;
          done: boolean;
          id: string;
          label: string;
          user_id: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          done?: boolean;
          id?: string;
          label: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          done?: boolean;
          id?: string;
          label?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      companion_invites: {
        Row: {
          companion_name: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          token: string;
          user_id: string;
        };
        Insert: {
          companion_name?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          token: string;
          user_id: string;
        };
        Update: {
          companion_name?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      doctor_questions: {
        Row: {
          answered: boolean;
          created_at: string;
          id: string;
          question: string;
          user_id: string;
        };
        Insert: {
          answered?: boolean;
          created_at?: string;
          id?: string;
          question: string;
          user_id: string;
        };
        Update: {
          answered?: boolean;
          created_at?: string;
          id?: string;
          question?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      health_logs: {
        Row: {
          created_at: string;
          diastolic: number | null;
          id: string;
          log_date: string;
          notes: string | null;
          systolic: number | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string;
          diastolic?: number | null;
          id?: string;
          log_date?: string;
          notes?: string | null;
          systolic?: number | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string;
          diastolic?: number | null;
          id?: string;
          log_date?: string;
          notes?: string | null;
          systolic?: number | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          content: string;
          created_at: string;
          entry_date: string;
          id: string;
          mood: string | null;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          entry_date?: string;
          id?: string;
          mood?: string | null;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          entry_date?: string;
          id?: string;
          mood?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      kick_sessions: {
        Row: {
          ended_at: string | null;
          id: string;
          kick_count: number;
          notes: string | null;
          started_at: string;
          user_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          kick_count?: number;
          notes?: string | null;
          started_at?: string;
          user_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          kick_count?: number;
          notes?: string | null;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      patient_profiles: {
        Row: {
          allergies: string | null;
          avatar_url: string | null;
          baby_name: string | null;
          blood_type: string | null;
          created_at: string;
          display_name: string | null;
          due_date: string | null;
          emergency_contact: string | null;
          emergency_phone: string | null;
          id: string;
          lmp_date: string | null;
          reference_date: string | null;
          reference_days: number | null;
          reference_weeks: number | null;
          updated_at: string;
        };
        Insert: {
          allergies?: string | null;
          avatar_url?: string | null;
          baby_name?: string | null;
          blood_type?: string | null;
          created_at?: string;
          display_name?: string | null;
          due_date?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          id: string;
          lmp_date?: string | null;
          reference_date?: string | null;
          reference_days?: number | null;
          reference_weeks?: number | null;
          updated_at?: string;
        };
        Update: {
          allergies?: string | null;
          avatar_url?: string | null;
          baby_name?: string | null;
          blood_type?: string | null;
          created_at?: string;
          display_name?: string | null;
          due_date?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          id?: string;
          lmp_date?: string | null;
          reference_date?: string | null;
          reference_days?: number | null;
          reference_weeks?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
