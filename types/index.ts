export type UserRole = 'user' | 'admin' | 'manager' | 'viewer'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_name: string
  company_id_number: string
  address: string
  phone: string
  email: string
  logo_storage_path: string | null
  footer_text: string
  default_payment_terms: string
  default_exclusions: string
}

export interface Quote {
  id: string
  user_id: string
  quote_number: string | null
  status: QuoteStatus
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

export interface QuoteWithItems extends Quote {
  quote_items: QuoteItem[]
}

export interface QuoteItem {
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

export interface ItemImage {
  id: string
  item_id: string
  storage_path: string
  include_in_pdf: boolean
  display_order: number
  caption: string
  created_at: string
}

// Form draft state — uses strings for numeric fields to support partial input
export interface QuoteItemDraft {
  tempId: string
  dbId?: string
  item_number: number
  description: string
  unit: string
  quantity: string
  unit_price: string
  notes: string
}

export interface QuoteHeaderDraft {
  client_name: string
  client_address: string
  client_contact: string
  project_description: string
  quote_date: string
  valid_until: string
  payment_terms: string
  exclusions: string
  vat_percentage: number
}

export const PREDEFINED_UNITS = [
  'יח׳', 'מ״ר', 'מ״א', 'מ״ק', 'קומפלט', 'ש״ע', 'יום עבודה', 'טון', 'ק״ג', 'נסיעה',
] as const

export const PAYMENT_TERMS_OPTIONS = [
  'תשלום מייד בסיום העבודה',
  'שוטף + 15',
  'שוטף + 30',
  'שוטף + 45',
  'שוטף + 60',
  'שוטף + 75',
  'שוטף + 90',
  'מקדמה 50% + שאר בסיום',
] as const

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'טיוטה',
  sent: 'נשלחה',
  accepted: 'אושרה',
  rejected: 'נדחתה',
}

export const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}
