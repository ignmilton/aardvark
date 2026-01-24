'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UPIPaymentButton } from './upi-payment-button';
import { fetchApi } from '@/lib/api';

interface CreditBundle {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceUSD: number; // in cents
  priceINR: number; // in paise
  isPopular: boolean;
}

// Fallback bundles used only if API is unavailable
const FALLBACK_BUNDLES: CreditBundle[] = [
  {
    id: 'bundle-starter',
    name: 'Starter Pack',
    credits: 100,
    bonusCredits: 0,
    priceUSD: 499,
    priceINR: 9900,
    isPopular: false,
  },
  {
    id: 'bundle-popular',
    name: 'Popular Pack',
    credits: 500,
    bonusCredits: 50,
    priceUSD: 1999,
    priceINR: 39900,
    isPopular: true,
  },
  {
    id: 'bundle-value',
    name: 'Value Pack',
    credits: 1000,
    bonusCredits: 150,
    priceUSD: 3499,
    priceINR: 69900,
    isPopular: false,
  },
];

interface CreditBundlesProps {
  onPurchaseSuccess?: (bundleId: string, credits: number) => void;
}

export function CreditBundles({ onPurchaseSuccess }: CreditBundlesProps) {
  const [bundles, setBundles] = useState<CreditBundle[]>(FALLBACK_BUNDLES);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingBundles, setIsLoadingBundles] = useState(true);

  useEffect(() => {
    async function loadBundles() {
      try {
        const response = await fetchApi<{ success: boolean; data: CreditBundle[] }>('/credits/bundles');
        if (response.data && response.data.length > 0) {
          setBundles(response.data);
        }
      } catch {
        // Use fallback bundles if API is unavailable
      } finally {
        setIsLoadingBundles(false);
      }
    }
    loadBundles();
  }, []);

  const formatUSD = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  };

  const handleStripeCheckout = async (bundle: CreditBundle) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/payments/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: bundle.id,
          successUrl: `${window.location.origin}/credits/success`,
          cancelUrl: `${window.location.origin}/credits`,
        }),
      });

      const data = await response.json();
      if (data.success && data.data.url) {
        // Validate redirect URL to prevent open redirect attacks
        try {
          const url = new URL(data.data.url);
          if (url.protocol === 'https:' && url.hostname.endsWith('.stripe.com')) {
            window.location.href = data.data.url;
          } else {
            console.error('Invalid checkout URL received');
          }
        } catch {
          console.error('Malformed checkout URL');
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Toggle */}
      <div className="flex items-center justify-center gap-2 p-1 bg-muted rounded-lg max-w-xs mx-auto">
        <button
          onClick={() => setPaymentMethod('upi')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            paymentMethod === 'upi'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <UPILogo className="w-4 h-4" />
            UPI (India)
          </span>
        </button>
        <button
          onClick={() => setPaymentMethod('card')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            paymentMethod === 'card'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <CardIcon className="w-4 h-4" />
            Card/Other
          </span>
        </button>
      </div>

      {/* Bundles Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {bundles.map((bundle) => (
          <div
            key={bundle.id}
            className={`relative p-6 rounded-xl border-2 transition-all border-border hover:border-primary/50 ${
              bundle.isPopular ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
          >
            {bundle.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center mb-4">
              <h3 className="font-semibold text-lg">{bundle.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold">
                  {paymentMethod === 'upi'
                    ? formatINR(bundle.priceINR)
                    : formatUSD(bundle.priceUSD)}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-center gap-2">
                <CoinIcon className="w-5 h-5 text-yellow-500" />
                <span className="font-medium">{bundle.credits} Credits</span>
              </div>
              {bundle.bonusCredits > 0 && (
                <div className="text-center">
                  <span className="text-green-600 font-medium text-sm">
                    +{bundle.bonusCredits} Bonus Credits!
                  </span>
                </div>
              )}
            </div>

            {paymentMethod === 'upi' ? (
              <UPIPaymentButton
                bundleId={bundle.id}
                bundleName={bundle.name}
                amountInRupees={bundle.priceINR / 100}
                credits={bundle.credits}
                bonusCredits={bundle.bonusCredits}
                onSuccess={() => onPurchaseSuccess?.(bundle.id, bundle.credits + bundle.bonusCredits)}
                className="w-full"
              />
            ) : (
              <Button
                onClick={() => handleStripeCheckout(bundle)}
                disabled={isProcessing}
                className="w-full"
                variant={bundle.isPopular ? 'default' : 'outline'}
              >
                {isProcessing ? 'Processing...' : 'Buy Now'}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Payment Info */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        {paymentMethod === 'upi' ? (
          <>
            <p>Pay securely with any UPI app - Google Pay, PhonePe, Paytm, etc.</p>
            <p>Powered by Razorpay. All transactions are encrypted and secure.</p>
          </>
        ) : (
          <>
            <p>Pay with credit/debit card, net banking, or wallets.</p>
            <p>Powered by Stripe. All transactions are encrypted and secure.</p>
          </>
        )}
      </div>
    </div>
  );
}

// Icons
function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
    </svg>
  );
}

function UPILogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.5 13.5h3v-3h-3v3zm0 6h3v-3h-3v3zm-6-6h3v-3h-3v3zm12 0h3v-3h-3v3zm-6-12h3v3h-3v-3zm-6 6h3v-3h-3v3zm12 0h3v-3h-3v3zm0 6h3v-3h-3v3zm-12 0h3v-3h-3v3zm6-12h3v3h-3v-3z" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}
