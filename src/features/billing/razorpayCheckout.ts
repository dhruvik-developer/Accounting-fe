import { api } from '@/app/api';

type RazorpayInstance = {
  open: () => void;
  on?: (event: string, handler: (response: unknown) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export type CheckoutIntent = {
  mode?: string;
  key_id?: string;
  order_id?: string;
  amount_paise?: number;
  currency?: string;
  subscription?: {
    pending_plan?: { name?: string } | null;
    plan?: { name?: string };
    pending_billing_cycle?: string;
    billing_cycle?: string;
  };
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

let checkoutScriptPromise: Promise<void> | null = null;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
}

export async function openRazorpayCheckout(intent: CheckoutIntent): Promise<RazorpaySuccess> {
  await loadRazorpayCheckout();
  if (!window.Razorpay) throw new Error('Razorpay checkout is not available.');
  if (!intent.key_id || !intent.order_id) throw new Error('Missing Razorpay checkout details.');

  const Razorpay = window.Razorpay;
  const plan = intent.subscription?.pending_plan || intent.subscription?.plan;
  const cycle = intent.subscription?.pending_billing_cycle || intent.subscription?.billing_cycle || 'monthly';

  return new Promise((resolve, reject) => {
    let completed = false;
    const checkout = new Razorpay({
      key: intent.key_id,
      amount: intent.amount_paise,
      currency: intent.currency || 'INR',
      name: 'VyaparPro',
      description: `${plan?.name || 'Plan'} · ${cycle}`,
      order_id: intent.order_id,
      theme: { color: '#2563EB' },
      handler: (response: RazorpaySuccess) => {
        completed = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!completed) reject(new Error('Payment cancelled.'));
        },
      },
    });

    checkout.on?.('payment.failed', (response) => {
      reject(new Error(extractRazorpayFailure(response)));
    });
    checkout.open();
  });
}

export async function verifyRazorpayPayment(response: RazorpaySuccess) {
  return api.post('/billing/subscription/verify-payment/', response);
}

function extractRazorpayFailure(response: any) {
  return response?.error?.description
    || response?.error?.reason
    || response?.error?.code
    || 'Payment failed.';
}
