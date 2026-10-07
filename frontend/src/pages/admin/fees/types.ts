// Types mirroring backend/app/schemas/{fee,payment}.py exactly.

export type FeeFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
export type InvoiceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentMethod = "CASH" | "CHEQUE" | "BANK_TRANSFER" | "PAYU";
export type PaymentStatus =
  | "CREATED"
  | "SUCCESS"
  | "FAILED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REFUND_FAILED";

export interface FeeCategory {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
}

export interface FeeCategoryCreateRequest {
  name: string;
  description?: string | null;
}

export interface FeeStructure {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  category_id: string;
  amount: number;
  frequency: FeeFrequency;
}

export interface FeeStructureCreateRequest {
  academic_year_id: string;
  class_id: string;
  category_id: string;
  amount: number;
  frequency: FeeFrequency;
}

export interface FeeAssignment {
  id: string;
  school_id: string;
  student_id: string;
  fee_structure_id: string;
  discount_amount: number;
  discount_reason: string | null;
  final_amount: number;
}

export interface FeeAssignmentCreateRequest {
  student_id: string;
  fee_structure_id: string;
  discount_amount?: number;
  discount_reason?: string | null;
}

export interface Invoice {
  id: string;
  school_id: string;
  student_id: string;
  academic_year_id: string;
  fee_assignment_ids: string[];
  total_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface InvoiceCreateRequest {
  student_id: string;
  academic_year_id: string;
  fee_assignment_ids: string[];
  due_date: string;
}

export interface ManualPaymentRequest {
  amount: number;
  method: PaymentMethod;
  note?: string | null;
}

export interface Payment {
  id: string;
  school_id: string;
  invoice_id: string;
  student_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  payu_txnid: string | null;
  payu_mihpayid: string | null;
  paid_at: string | null;
  recorded_by: string | null;
}

export interface PayURefundRequest {
  payment_id: string;
  amount: number;
  reason?: string | null;
}

export interface PayURefundResponse {
  payment_id: string;
  status: PaymentStatus;
  refund_token: string;
  refund_request_id: string | null;
  message: string;
}

/** Minimal shape we read off GET /students for the fee-lookup search box. */
export interface StudentLite {
  id: string;
  full_name: string;
  admission_no: string;
  academic_year_id: string;
  class_id: string;
  section_id: string;
}
