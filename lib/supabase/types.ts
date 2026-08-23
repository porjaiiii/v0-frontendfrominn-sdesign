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
    PostgrestVersion: "14.15"
  }
  app: {
    Tables: {
      admin_keys: {
        Row: {
          activated_at: string | null
          key: string
          line_user_id: string | null
          status: string
        }
        Insert: {
          activated_at?: string | null
          key: string
          line_user_id?: string | null
          status?: string
        }
        Update: {
          activated_at?: string | null
          key?: string
          line_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_keys_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "admin_keys_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "admin_keys_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
        ]
      }
      coupons: {
        Row: {
          coupon_id: string
          created_at: string
          expires_at: string | null
          idempotency_key: string | null
          is_legacy: boolean
          line_user_id: string
          points_used: number
          redeem_type: string | null
          redeemed_at: string
          reward_description: string
          reward_id: number | null
          reward_image: string
          reward_name: string
          scanned_by: string | null
          status: string
          tx_id: string | null
          used_at: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          expires_at?: string | null
          idempotency_key?: string | null
          is_legacy?: boolean
          line_user_id: string
          points_used: number
          redeem_type?: string | null
          redeemed_at?: string
          reward_description?: string
          reward_id?: number | null
          reward_image?: string
          reward_name: string
          scanned_by?: string | null
          status?: string
          tx_id?: string | null
          used_at?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          expires_at?: string | null
          idempotency_key?: string | null
          is_legacy?: boolean
          line_user_id?: string
          points_used?: number
          redeem_type?: string | null
          redeemed_at?: string
          reward_description?: string
          reward_id?: number | null
          reward_image?: string
          reward_name?: string
          scanned_by?: string | null
          status?: string
          tx_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "coupons_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "coupons_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "coupons_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "point_transactions"
            referencedColumns: ["tx_id"]
          },
        ]
      }
      donation_campaigns: {
        Row: {
          closes_at: string | null
          created_at: string
          current_amount: number
          description: string
          id: number
          image_path: string
          is_active: boolean
          name: string
          opened_at: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          current_amount?: number
          description?: string
          id?: never
          image_path?: string
          is_active?: boolean
          name: string
          opened_at?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          current_amount?: number
          description?: string
          id?: never
          image_path?: string
          is_active?: boolean
          name?: string
          opened_at?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      point_ledger_entries: {
        Row: {
          created_at: string
          id: number
          lot_id: number
          points_delta: number
          tx_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          lot_id: number
          points_delta: number
          tx_id: string
        }
        Update: {
          created_at?: string
          id?: never
          lot_id?: number
          points_delta?: number
          tx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_ledger_entries_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "point_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "point_transactions"
            referencedColumns: ["tx_id"]
          },
        ]
      }
      point_lots: {
        Row: {
          consumed_points: number
          created_at: string
          earned_at: string
          earned_points: number
          expires_at: string | null
          id: number
          is_legacy: boolean
          line_user_id: string
          period: string
          remaining_points: number | null
          source_waste_id: number | null
          status: string
        }
        Insert: {
          consumed_points?: number
          created_at?: string
          earned_at?: string
          earned_points?: number
          expires_at?: string | null
          id?: never
          is_legacy?: boolean
          line_user_id: string
          period: string
          remaining_points?: number | null
          source_waste_id?: number | null
          status?: string
        }
        Update: {
          consumed_points?: number
          created_at?: string
          earned_at?: string
          earned_points?: number
          expires_at?: string | null
          id?: never
          is_legacy?: boolean
          line_user_id?: string
          period?: string
          remaining_points?: number | null
          source_waste_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_lots_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "point_lots_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "point_lots_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "point_lots_source_waste_id_fkey"
            columns: ["source_waste_id"]
            isOneToOne: false
            referencedRelation: "waste_records"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          category: string | null
          co2_kg: number
          created_at: string
          idempotency_key: string | null
          is_legacy: boolean
          kind: string
          line_user_id: string
          occurred_at: string
          points_delta: number
          tx_id: string
          weight_kg: number
        }
        Insert: {
          category?: string | null
          co2_kg?: number
          created_at?: string
          idempotency_key?: string | null
          is_legacy?: boolean
          kind: string
          line_user_id: string
          occurred_at?: string
          points_delta: number
          tx_id: string
          weight_kg?: number
        }
        Update: {
          category?: string | null
          co2_kg?: number
          created_at?: string
          idempotency_key?: string | null
          is_legacy?: boolean
          kind?: string
          line_user_id?: string
          occurred_at?: string
          points_delta?: number
          tx_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "point_transactions_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "point_transactions_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
        ]
      }
      points_accounts: {
        Row: {
          last_updated: string
          lifetime_earned: number
          lifetime_spent: number
          line_user_id: string
          tier: string
          total_co2_kg: number
          total_weight_kg: number
        }
        Insert: {
          last_updated?: string
          lifetime_earned?: number
          lifetime_spent?: number
          line_user_id: string
          tier?: string
          total_co2_kg?: number
          total_weight_kg?: number
        }
        Update: {
          last_updated?: string
          lifetime_earned?: number
          lifetime_spent?: number
          line_user_id?: string
          tier?: string
          total_co2_kg?: number
          total_weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "points_accounts_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "points_accounts_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: true
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "points_accounts_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: true
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
        ]
      }
      ref_age_range: {
        Row: {
          is_active: boolean
          sort_order: number
          value: string
        }
        Insert: {
          is_active?: boolean
          sort_order?: number
          value: string
        }
        Update: {
          is_active?: boolean
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      ref_gender: {
        Row: {
          is_active: boolean
          sort_order: number
          value: string
        }
        Insert: {
          is_active?: boolean
          sort_order?: number
          value: string
        }
        Update: {
          is_active?: boolean
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      ref_occupation: {
        Row: {
          is_active: boolean
          sort_order: number
          value: string
        }
        Insert: {
          is_active?: boolean
          sort_order?: number
          value: string
        }
        Update: {
          is_active?: boolean
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      ref_subdistrict: {
        Row: {
          is_active: boolean
          sort_order: number
          value: string
        }
        Insert: {
          is_active?: boolean
          sort_order?: number
          value: string
        }
        Update: {
          is_active?: boolean
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      ref_user_type: {
        Row: {
          is_active: boolean
          is_tourist: boolean
          sort_order: number
          value: string
        }
        Insert: {
          is_active?: boolean
          is_tourist?: boolean
          sort_order?: number
          value: string
        }
        Update: {
          is_active?: boolean
          is_tourist?: boolean
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          created_at: string
          description: string
          id: number
          image_path: string
          is_active: boolean
          is_variable: boolean
          min_points: number | null
          name: string
          points: number
          sort_order: number
          stock: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id: number
          image_path?: string
          is_active?: boolean
          is_variable?: boolean
          min_points?: number | null
          name: string
          points: number
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          image_path?: string
          is_active?: boolean
          is_variable?: boolean
          min_points?: number | null
          name?: string
          points?: number
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      spend_details: {
        Row: {
          category: string
          id: number
          item_name: string
          line_user_id: string
          occurred_at: string
          points: number
          quantity: number
          status: string
          tx_id: string
        }
        Insert: {
          category?: string
          id?: never
          item_name?: string
          line_user_id: string
          occurred_at?: string
          points?: number
          quantity?: number
          status: string
          tx_id: string
        }
        Update: {
          category?: string
          id?: never
          item_name?: string
          line_user_id?: string
          occurred_at?: string
          points?: number
          quantity?: number
          status?: string
          tx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spend_details_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "spend_details_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "spend_details_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "spend_details_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "point_transactions"
            referencedColumns: ["tx_id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          age_range: string | null
          created_at: string
          display_user_id: string | null
          full_name: string | null
          gender: string | null
          is_legacy: boolean
          line_user_id: string
          nickname: string | null
          occupation: string | null
          pdpa_consent: string | null
          phone_number: string | null
          registered_at: string
          registration_date_th: string | null
          subdistrict: string | null
          updated_at: string
          user_type: string | null
        }
        Insert: {
          address?: string | null
          age_range?: string | null
          created_at?: string
          display_user_id?: string | null
          full_name?: string | null
          gender?: string | null
          is_legacy?: boolean
          line_user_id: string
          nickname?: string | null
          occupation?: string | null
          pdpa_consent?: string | null
          phone_number?: string | null
          registered_at?: string
          registration_date_th?: string | null
          subdistrict?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          address?: string | null
          age_range?: string | null
          created_at?: string
          display_user_id?: string | null
          full_name?: string | null
          gender?: string | null
          is_legacy?: boolean
          line_user_id?: string
          nickname?: string | null
          occupation?: string | null
          pdpa_consent?: string | null
          phone_number?: string | null
          registered_at?: string
          registration_date_th?: string | null
          subdistrict?: string | null
          updated_at?: string
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_age_range_fkey"
            columns: ["age_range"]
            isOneToOne: false
            referencedRelation: "ref_age_range"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "users_gender_fkey"
            columns: ["gender"]
            isOneToOne: false
            referencedRelation: "ref_gender"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "users_occupation_fkey"
            columns: ["occupation"]
            isOneToOne: false
            referencedRelation: "ref_occupation"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "users_subdistrict_fkey"
            columns: ["subdistrict"]
            isOneToOne: false
            referencedRelation: "ref_subdistrict"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "users_user_type_fkey"
            columns: ["user_type"]
            isOneToOne: false
            referencedRelation: "ref_user_type"
            referencedColumns: ["value"]
          },
        ]
      }
      waste_records: {
        Row: {
          applied_carbon_factor: number | null
          applied_points_per_kg: number | null
          carbon_reduction_kg: number
          created_at: string
          id: number
          idempotency_key: string | null
          image_urls: string[]
          is_legacy: boolean
          line_user_id: string
          notes: string | null
          points_earned: number
          recorded_at: string
          status: string
          updated_at: string
          waste_subtype_id: string | null
          waste_type_id: string
          weight_kg: number | null
        }
        Insert: {
          applied_carbon_factor?: number | null
          applied_points_per_kg?: number | null
          carbon_reduction_kg?: number
          created_at?: string
          id?: never
          idempotency_key?: string | null
          image_urls?: string[]
          is_legacy?: boolean
          line_user_id: string
          notes?: string | null
          points_earned?: number
          recorded_at: string
          status?: string
          updated_at?: string
          waste_subtype_id?: string | null
          waste_type_id: string
          weight_kg?: number | null
        }
        Update: {
          applied_carbon_factor?: number | null
          applied_points_per_kg?: number | null
          carbon_reduction_kg?: number
          created_at?: string
          id?: never
          idempotency_key?: string | null
          image_urls?: string[]
          is_legacy?: boolean
          line_user_id?: string
          notes?: string | null
          points_earned?: number
          recorded_at?: string
          status?: string
          updated_at?: string
          waste_subtype_id?: string | null
          waste_type_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "waste_records_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "waste_records_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "waste_records_subtype_fk"
            columns: ["waste_type_id", "waste_subtype_id"]
            isOneToOne: false
            referencedRelation: "waste_subtypes"
            referencedColumns: ["waste_type_id", "id"]
          },
          {
            foreignKeyName: "waste_records_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_subtypes: {
        Row: {
          description_th: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name_th: string
          sort_order: number
          waste_type_id: string
        }
        Insert: {
          description_th?: string | null
          id: string
          image_path?: string | null
          is_active?: boolean
          name_th: string
          sort_order?: number
          waste_type_id: string
        }
        Update: {
          description_th?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name_th?: string
          sort_order?: number
          waste_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_subtypes_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_types: {
        Row: {
          carbon_factor: number
          created_at: string
          icon_path: string | null
          id: string
          is_active: boolean
          name_th: string
          points_per_kg: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          carbon_factor: number
          created_at?: string
          icon_path?: string | null
          id: string
          is_active?: boolean
          name_th: string
          points_per_kg: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          carbon_factor?: number
          created_at?: string
          icon_path?: string | null
          id?: string
          is_active?: boolean
          name_th?: string
          points_per_kg?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_co2_collection: {
        Row: {
          co2: number | null
          last_updated: string | null
          line_user_id: string | null
          waste_type: string | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "waste_records_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_leaderboard"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "waste_records_line_user_id_fkey"
            columns: ["line_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_balances"
            referencedColumns: ["line_user_id"]
          },
          {
            foreignKeyName: "waste_records_waste_type_id_fkey"
            columns: ["waste_type"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      v_leaderboard: {
        Row: {
          display_name: string | null
          is_tourist: boolean | null
          line_user_id: string | null
          subdistrict: string | null
          tier: string | null
          total_co2: number | null
          total_points: number | null
          total_weight: number | null
        }
        Relationships: []
      }
      v_user_balances: {
        Row: {
          line_user_id: string | null
          spendable_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_admin_key: {
        Args: { p_key: string; p_line_user_id: string }
        Returns: Json
      }
      confirm_waste: {
        Args: {
          p_idempotency_key?: string
          p_image_urls?: string[]
          p_line_user_id: string
          p_notes?: string
          p_recorded_at: string
          p_waste_subtype_id?: string
          p_waste_type_id?: string
          p_weight_kg?: number
        }
        Returns: Json
      }
      consume_lots: {
        Args: { p_line_user_id: string; p_points: number }
        Returns: Json
      }
      coupon_json: {
        Args: { p_coupon: Database["app"]["Tables"]["coupons"]["Row"] }
        Returns: Json
      }
      expire_points: { Args: never; Returns: number }
      new_coupon_id: { Args: never; Returns: string }
      new_tx_id: { Args: never; Returns: string }
      period_expires_at: { Args: { p_period: string }; Returns: string }
      period_of: { Args: { p_at: string }; Returns: string }
      record_spend: {
        Args: {
          p_category: string
          p_entries: Json
          p_idempotency_key: string
          p_line_user_id: string
          p_points: number
        }
        Returns: string
      }
      redeem_rewards: {
        Args: {
          p_idempotency_key?: string
          p_items: Json
          p_line_user_id: string
          p_redeem_type?: string
        }
        Returns: Json
      }
      spend_points: {
        Args: {
          p_category?: string
          p_idempotency_key?: string
          p_items?: Json
          p_line_user_id: string
          p_points: number
        }
        Returns: Json
      }
      submit_waste: {
        Args: {
          p_idempotency_key?: string
          p_image_urls?: string[]
          p_line_user_id: string
          p_notes?: string
          p_waste_subtype_id: string
          p_waste_type_id: string
          p_weight_kg?: number
        }
        Returns: Json
      }
      tier_for_weight: { Args: { p_weight_kg: number }; Returns: string }
      use_coupon: {
        Args: { p_coupon_id: string; p_scanned_by?: string }
        Returns: Json
      }
      waste_record_json: {
        Args: { p_record: Database["app"]["Tables"]["waste_records"]["Row"] }
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
  app: {
    Enums: {},
  },
} as const
