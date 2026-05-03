export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'user' | 'admin' | 'manager' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          role?: 'user' | 'admin' | 'manager' | 'viewer'
        }
        Update: {
          full_name?: string
          role?: 'user' | 'admin' | 'manager' | 'viewer'
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          id: string
          singleton_key: number
          company_name: string
          company_id_number: string
          address: string
          phone: string
          email: string
          logo_storage_path: string | null
          footer_text: string
          default_payment_terms: string
          default_exclusions: string
          created_at: string
          updated_at: string
        }
        Insert: {
          company_name?: string
          company_id_number?: string
          address?: string
          phone?: string
          email?: string
          logo_storage_path?: string | null
          footer_text?: string
          default_payment_terms?: string
          default_exclusions?: string
        }
        Update: {
          company_name?: string
          company_id_number?: string
          address?: string
          phone?: string
          email?: string
          logo_storage_path?: string | null
          footer_text?: string
          default_payment_terms?: string
          default_exclusions?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          quote_number: string | null
          status: 'draft' | 'sent' | 'accepted' | 'rejected'
          client_name: string
          client_address: string
          client_contact: string
          project_description: string
          quote_date: string
          valid_until: string | null
          payment_terms: string
          exclusions: string
          vat_percentage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          status?: 'draft' | 'sent' | 'accepted' | 'rejected'
          client_name?: string
          client_address?: string
          client_contact?: string
          project_description?: string
          quote_date?: string
          valid_until?: string | null
          payment_terms?: string
          exclusions?: string
          vat_percentage?: number
        }
        Update: {
          status?: 'draft' | 'sent' | 'accepted' | 'rejected'
          client_name?: string
          client_address?: string
          client_contact?: string
          project_description?: string
          quote_date?: string
          valid_until?: string | null
          payment_terms?: string
          exclusions?: string
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          item_number: number
          description: string
          unit: string
          quantity: number
          unit_price: number
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          quote_id: string
          item_number: number
          description?: string
          unit?: string
          quantity?: number
          unit_price?: number
          notes?: string
        }
        Update: {
          item_number?: number
          description?: string
          unit?: string
          quantity?: number
          unit_price?: number
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_items_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          }
        ]
      }
      item_images: {
        Row: {
          id: string
          item_id: string
          storage_path: string
          include_in_pdf: boolean
          display_order: number
          caption: string
          created_at: string
        }
        Insert: {
          item_id: string
          storage_path: string
          include_in_pdf?: boolean
          display_order?: number
          caption?: string
        }
        Update: {
          include_in_pdf?: boolean
          display_order?: number
          caption?: string
        }
        Relationships: [
          {
            foreignKeyName: 'item_images_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'quote_items'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
