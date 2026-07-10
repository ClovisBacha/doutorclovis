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
      baby_letters: {
        Row: {
          content: string;
          generated_at: string;
          id: string;
          user_id: string;
          week: number;
        };
        Insert: {
          content: string;
          generated_at?: string;
          id?: string;
          user_id: string;
          week: number;
        };
        Update: {
          content?: string;
          generated_at?: string;
          id?: string;
          user_id?: string;
          week?: number;
        };
        Relationships: [];
      };
      baby_milestones: {
        Row: {
          achieved_at: string;
          created_at: string;
          custom_label: string | null;
          id: string;
          milestone_key: string;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          achieved_at: string;
          created_at?: string;
          custom_label?: string | null;
          id?: string;
          milestone_key: string;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          created_at?: string;
          custom_label?: string | null;
          id?: string;
          milestone_key?: string;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      baby_name_entries: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          session_id: string;
          suggested_by: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          session_id: string;
          suggested_by?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          session_id?: string;
          suggested_by?: string;
        };
        Relationships: [];
      };
      baby_name_sessions: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean | null;
          patient_user_id: string;
          reveal_winner: boolean | null;
          share_token: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean | null;
          patient_user_id: string;
          reveal_winner?: boolean | null;
          share_token?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean | null;
          patient_user_id?: string;
          reveal_winner?: boolean | null;
          share_token?: string;
        };
        Relationships: [];
      };
      baby_name_votes: {
        Row: {
          created_at: string;
          entry_id: string;
          id: string;
          voter_name: string;
          voter_token: string;
        };
        Insert: {
          created_at?: string;
          entry_id: string;
          id?: string;
          voter_name?: string;
          voter_token: string;
        };
        Update: {
          created_at?: string;
          entry_id?: string;
          id?: string;
          voter_name?: string;
          voter_token?: string;
        };
        Relationships: [];
      };
      baby_vaccines: {
        Row: {
          administered_at: string;
          batch: string | null;
          created_at: string;
          id: string;
          user_id: string;
          vaccine_key: string;
        };
        Insert: {
          administered_at: string;
          batch?: string | null;
          created_at?: string;
          id?: string;
          user_id: string;
          vaccine_key: string;
        };
        Update: {
          administered_at?: string;
          batch?: string | null;
          created_at?: string;
          id?: string;
          user_id?: string;
          vaccine_key?: string;
        };
        Relationships: [];
      };
      baby_weights: {
        Row: {
          created_at: string;
          id: string;
          measured_at: string;
          user_id: string;
          weight_g: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          measured_at: string;
          user_id: string;
          weight_g: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          measured_at?: string;
          user_id?: string;
          weight_g?: number;
        };
        Relationships: [];
      };
      birth_plans: {
        Row: {
          birth_type: string | null;
          breastfeeding: string | null;
          cord_cutting: string | null;
          id: string;
          lighting: string | null;
          music: string | null;
          notes: string | null;
          pain_relief: string[] | null;
          skin_to_skin: boolean | null;
          updated_at: string;
          user_id: string;
          who_present: string | null;
        };
        Insert: {
          birth_type?: string | null;
          breastfeeding?: string | null;
          cord_cutting?: string | null;
          id?: string;
          lighting?: string | null;
          music?: string | null;
          notes?: string | null;
          pain_relief?: string[] | null;
          skin_to_skin?: boolean | null;
          updated_at?: string;
          user_id: string;
          who_present?: string | null;
        };
        Update: {
          birth_type?: string | null;
          breastfeeding?: string | null;
          cord_cutting?: string | null;
          id?: string;
          lighting?: string | null;
          music?: string | null;
          notes?: string | null;
          pain_relief?: string[] | null;
          skin_to_skin?: boolean | null;
          updated_at?: string;
          user_id?: string;
          who_present?: string | null;
        };
        Relationships: [];
      };
      breastfeeding_logs: {
        Row: {
          created_at: string;
          ended_at: string | null;
          id: string;
          notes: string | null;
          side: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          side?: string;
          started_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          side?: string;
          started_at?: string;
          user_id?: string;
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
      consultation_notes: {
        Row: {
          created_at: string;
          id: string;
          medicamentos: string | null;
          orientacoes: string | null;
          proxima_consulta: string | null;
          proximos_exames: string | null;
          raw_transcript: string | null;
          recorded_at: string;
          title: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          medicamentos?: string | null;
          orientacoes?: string | null;
          proxima_consulta?: string | null;
          proximos_exames?: string | null;
          raw_transcript?: string | null;
          recorded_at?: string;
          title?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          medicamentos?: string | null;
          orientacoes?: string | null;
          proxima_consulta?: string | null;
          proximos_exames?: string | null;
          raw_transcript?: string | null;
          recorded_at?: string;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      contraction_logs: {
        Row: {
          created_at: string;
          ended_at: string | null;
          id: string;
          intensity: number | null;
          notes: string | null;
          started_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          intensity?: number | null;
          notes?: string | null;
          started_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          intensity?: number | null;
          notes?: string | null;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      course_progress: {
        Row: {
          completed_at: string;
          id: string;
          module_week: number;
          quiz_score: number | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string;
          id?: string;
          module_week: number;
          quiz_score?: number | null;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          id?: string;
          module_week?: number;
          quiz_score?: number | null;
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
      exam_files: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          image_data: string | null;
          name: string;
          notes: string | null;
          user_id: string;
          week: number | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          id?: string;
          image_data?: string | null;
          name: string;
          notes?: string | null;
          user_id: string;
          week?: number | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          image_data?: string | null;
          name?: string;
          notes?: string | null;
          user_id?: string;
          week?: number | null;
        };
        Relationships: [];
      };
      family_album_posts: {
        Row: {
          author_name: string;
          caption: string | null;
          created_at: string;
          emoji: string | null;
          id: string;
          image_data: string | null;
          patient_user_id: string;
        };
        Insert: {
          author_name?: string;
          caption?: string | null;
          created_at?: string;
          emoji?: string | null;
          id?: string;
          image_data?: string | null;
          patient_user_id: string;
        };
        Update: {
          author_name?: string;
          caption?: string | null;
          created_at?: string;
          emoji?: string | null;
          id?: string;
          image_data?: string | null;
          patient_user_id?: string;
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
      panic_events: {
        Row: {
          address: string | null;
          created_at: string;
          id: string;
          latitude: number | null;
          longitude: number | null;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          user_id: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
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
      ppd_screenings: {
        Row: {
          answers: Json;
          id: string;
          score: number;
          screened_at: string;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          id?: string;
          score: number;
          screened_at?: string;
          user_id: string;
        };
        Update: {
          answers?: Json;
          id?: string;
          score?: number;
          screened_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      preconsulta_forms: {
        Row: {
          current_weight: number | null;
          diastolic: number | null;
          emotional_state: string | null;
          id: string;
          medications: string | null;
          other_notes: string | null;
          questions: string | null;
          seen_by_doctor: boolean | null;
          submitted_at: string;
          symptoms: string[] | null;
          systolic: number | null;
          user_id: string;
          weeks_at_submission: number | null;
        };
        Insert: {
          current_weight?: number | null;
          diastolic?: number | null;
          emotional_state?: string | null;
          id?: string;
          medications?: string | null;
          other_notes?: string | null;
          questions?: string | null;
          seen_by_doctor?: boolean | null;
          submitted_at?: string;
          symptoms?: string[] | null;
          systolic?: number | null;
          user_id: string;
          weeks_at_submission?: number | null;
        };
        Update: {
          current_weight?: number | null;
          diastolic?: number | null;
          emotional_state?: string | null;
          id?: string;
          medications?: string | null;
          other_notes?: string | null;
          questions?: string | null;
          seen_by_doctor?: boolean | null;
          submitted_at?: string;
          symptoms?: string[] | null;
          systolic?: number | null;
          user_id?: string;
          weeks_at_submission?: number | null;
        };
        Relationships: [];
      };
      private_consultations: {
        Row: {
          amount_cents: number | null;
          consult_type: string;
          created_at: string;
          id: string;
          message: string | null;
          mp_payment_id: string | null;
          patient_user_id: string;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          preferred_dates: string[] | null;
          status: string;
        };
        Insert: {
          amount_cents?: number | null;
          consult_type: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          mp_payment_id?: string | null;
          patient_user_id: string;
          pix_qr_code?: string | null;
          pix_qr_code_base64?: string | null;
          preferred_dates?: string[] | null;
          status?: string;
        };
        Update: {
          amount_cents?: number | null;
          consult_type?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          mp_payment_id?: string | null;
          patient_user_id?: string;
          pix_qr_code?: string | null;
          pix_qr_code_base64?: string | null;
          preferred_dates?: string[] | null;
          status?: string;
        };
        Relationships: [];
      };
      teleconsulta_sessions: {
        Row: {
          clinical_note: string | null;
          created_at: string;
          doctor_notes: string | null;
          id: string;
          meet_url: string | null;
          patient_notes: string | null;
          patient_user_id: string;
          room_name: string;
          scheduled_for: string | null;
          status: string;
        };
        Insert: {
          clinical_note?: string | null;
          created_at?: string;
          doctor_notes?: string | null;
          id?: string;
          meet_url?: string | null;
          patient_notes?: string | null;
          patient_user_id: string;
          room_name?: string;
          scheduled_for?: string | null;
          status?: string;
        };
        Update: {
          clinical_note?: string | null;
          created_at?: string;
          doctor_notes?: string | null;
          id?: string;
          meet_url?: string | null;
          patient_notes?: string | null;
          patient_user_id?: string;
          room_name?: string;
          scheduled_for?: string | null;
          status?: string;
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
