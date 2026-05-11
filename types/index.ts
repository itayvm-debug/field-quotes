export type UserRole = 'user' | 'admin' | 'manager' | 'viewer'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'closed_partial'

export interface Profile {
  id: string
  full_name: string
  job_title: string
  role: UserRole
  is_active: boolean
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
  // Payment tracking (added in migration 007)
  payment_status: PaymentStatus
  paid_amount: number
  paid_at: string | null
  approved_at: string | null
  rejected_at: string | null
  status_note: string
  closed_payment_note: string
  payment_closed_at: string | null
  payment_closed_by: string | null
  // Overpayment tracking (added in migration 008)
  overpayment_note?: string
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
  'תשלום מראש',
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
  archived: 'בארכיון',
}

export const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  archived: 'bg-gray-700 text-gray-100',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'לא שולם',
  partial: 'שולם חלקית',
  paid: 'שולם',
  closed_partial: 'שולם חלקית ונסגר',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-orange-100 text-orange-700',
  paid: 'bg-green-100 text-green-700',
  closed_partial: 'bg-gray-100 text-gray-500',
}

export const DEFAULT_EXCLUSIONS =
  'ההצעה אינה כוללת עבודות שלא צוינו במפורש.\n' +
  'ההצעה אינה כוללת טיפול בתשתיות נסתרות שלא סומנו מראש.\n' +
  'ההצעה כפופה לאישור המזמין ולתיאום גישה לאתר.'
