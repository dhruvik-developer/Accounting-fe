export type ExpenseStatus = 'paid' | 'unpaid' | 'overdue' | 'partial' | 'cancelled';
export type ApprovalStatus = 'approved' | 'pending' | 'rejected' | 'not_required';
export type PaymentMode = 'cash' | 'bank' | 'upi' | 'card' | 'cheque' | 'wallet';
export type TaxType = 'gst' | 'igst' | 'exempt' | 'none';

export type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  parent_id?: string | null;
  is_active: boolean;
};

export type Expense = {
  id: string;
  expense_number: string;
  expense_date: string;          // YYYY-MM-DD
  category_id: string;
  category_name?: string;        // denormalised for display
  vendor_name: string;
  vendor_gstin?: string;
  description: string;
  amount: number;                // pre-tax
  tax_type: TaxType;
  gst_rate: number;              // e.g. 18
  gst_amount: number;            // computed
  total_amount: number;
  payment_mode: PaymentMode;
  paid_amount: number;
  status: ExpenseStatus;
  approval_status: ApprovalStatus;
  is_recurring: boolean;
  recurring_period?: 'monthly' | 'quarterly' | 'yearly';
  attachment_name?: string;      // filename only — file persists in mock as base64 if added
  notes?: string;
  branch_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseInput = Omit<Expense, 'id' | 'expense_number' | 'created_at' | 'updated_at' | 'category_name'>;
