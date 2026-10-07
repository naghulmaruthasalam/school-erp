import { api } from "../../../api/client";
import type { PageResponse } from "../../../types/common";
import type {
  FeeAssignment,
  FeeAssignmentCreateRequest,
  FeeCategory,
  FeeCategoryCreateRequest,
  FeeStructure,
  FeeStructureCreateRequest,
  Invoice,
  InvoiceCreateRequest,
  InvoiceStatus,
  ManualPaymentRequest,
  Payment,
  PayURefundRequest,
  PayURefundResponse,
  StudentLite,
} from "./types";

// ---------------------------------------------------------------------------
// FeeCategory
// ---------------------------------------------------------------------------

export const listFeeCategories = async () => (await api.get<FeeCategory[]>("/fees/categories")).data;

export const createFeeCategory = async (payload: FeeCategoryCreateRequest) =>
  (await api.post<FeeCategory>("/fees/categories", payload)).data;

// ---------------------------------------------------------------------------
// FeeStructure
// ---------------------------------------------------------------------------

export const listFeeStructures = async (params: { academic_year_id?: string; class_id?: string } = {}) =>
  (await api.get<FeeStructure[]>("/fees/structures", { params })).data;

export const createFeeStructure = async (payload: FeeStructureCreateRequest) =>
  (await api.post<FeeStructure>("/fees/structures", payload)).data;

// ---------------------------------------------------------------------------
// FeeAssignment
// ---------------------------------------------------------------------------

export const createFeeAssignment = async (payload: FeeAssignmentCreateRequest) =>
  (await api.post<FeeAssignment>("/fees/assignments", payload)).data;

export const listFeeAssignments = async (studentId: string) =>
  (await api.get<FeeAssignment[]>("/fees/assignments", { params: { student_id: studentId } })).data;

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export const createInvoice = async (payload: InvoiceCreateRequest) =>
  (await api.post<Invoice>("/fees/invoices", payload)).data;

export const listInvoices = async (
  params: { student_id?: string; status?: InvoiceStatus; academic_year_id?: string; page?: number; page_size?: number } = {},
) => (await api.get<PageResponse<Invoice>>("/fees/invoices", { params })).data;

export const getInvoice = async (id: string) => (await api.get<Invoice>(`/fees/invoices/${id}`)).data;

/** Response is a raw PDF receipt (application/pdf), not JSON — caller downloads/opens the blob. */
export const recordManualPayment = async (invoiceId: string, payload: ManualPaymentRequest) =>
  (
    await api.post(`/fees/invoices/${invoiceId}/payments/manual`, payload, {
      responseType: "blob",
    })
  ).data as Blob;

export const listInvoicePayments = async (invoiceId: string) =>
  (await api.get<Payment[]>(`/fees/invoices/${invoiceId}/payments`)).data;

// ---------------------------------------------------------------------------
// PayU refunds
// ---------------------------------------------------------------------------

export const initiateRefund = async (payload: PayURefundRequest) =>
  (await api.post<PayURefundResponse>("/payments/payu/refund", payload)).data;

// ---------------------------------------------------------------------------
// Students (read-only lookup for the fee overview search box)
// ---------------------------------------------------------------------------

export const searchStudents = async (name: string) =>
  (await api.get<PageResponse<StudentLite>>("/students", { params: { name, page_size: 20 } })).data.items;
