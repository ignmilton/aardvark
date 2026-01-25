'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Crown,
  Check,
  Zap,
  BookOpen,
  Shield,
  Star,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeature[];
  isPopular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      { text: 'Read free stories', included: true },
      { text: 'Create up to 3 stories', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Community support', included: true },
      { text: 'Ads while reading', included: true },
      { text: 'Premium stories', included: false },
      { text: 'Early access to new features', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Unlock the full experience',
    priceMonthly: 999, // in cents
    priceYearly: 7999, // in cents (save ~33%)
    isPopular: true,
    features: [
      { text: 'Read free stories', included: true },
      { text: 'Unlimited story creation', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Priority support', included: true },
      { text: 'Ad-free reading', included: true },
      { text: 'Access all premium stories', included: true },
      { text: 'Early access to new features', included: true },
      { text: 'Exclusive author badges', included: true },
    ],
  },
];

export default function PremiumPage() {
  const router = useRouter();
  const { isAuthenticated, isPremium } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/premium');
      return;
    }

    if (planId === 'free') {
      toast.success('You are on the free plan');
      return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          interval: billingCycle,
          successUrl: `${window.location.origin}/premium/success`,
          cancelUrl: `${window.location.origin}/premium`,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        toast.error(data.message || 'Failed to start checkout');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subscriptions/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/premium`,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch (error) {
      toast.error('Failed to open subscription portal');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full mb-4">
            <Crown className="h-5 w-5" />
            <span className="font-medium">Premium</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Unlock the Full Aardvark Experience
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get unlimited access to premium stories, ad-free reading, and exclusive features
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={billingCycle === 'monthly' ? 'font-medium' : 'text-muted-foreground'}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-14 h-7 bg-muted rounded-full transition-colors"
            role="switch"
            aria-checked={billingCycle === 'yearly'}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-primary rounded-full transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className={billingCycle === 'yearly' ? 'font-medium' : 'text-muted-foreground'}>
            Yearly
            <span className="ml-1 text-xs text-green-600 font-medium">Save 33%</span>
          </span>
        </div>

        {/* Current Status */}
        {isPremium && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
            <Crown className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              You're a Premium Member!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Thank you for supporting Aardvark
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleManageSubscription}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage Subscription'}
            </Button>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-6 rounded-2xl border-2 ${
                plan.isPopular
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Recommended
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {formatPrice(billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly / 12)}
                  </span>
                  {plan.priceMonthly > 0 && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>
                {billingCycle === 'yearly' && plan.priceYearly > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed {formatPrice(plan.priceYearly)} yearly
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <span className="h-5 w-5 flex items-center justify-center text-muted-foreground shrink-0">
                        —
                      </span>
                    )}
                    <span className={feature.included ? '' : 'text-muted-foreground'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.isPopular ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.id)}
                disabled={isProcessing || (plan.id === 'premium' && isPremium)}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : plan.id === 'free' ? (
                  'Current Plan'
                ) : isPremium ? (
                  'Current Plan'
                ) : (
                  'Upgrade Now'
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">Premium Benefits</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Ad-Free Reading',
                description: 'Enjoy stories without interruptions',
              },
              {
                icon: BookOpen,
                title: 'Premium Stories',
                description: 'Access exclusive premium content',
              },
              {
                icon: Shield,
                title: 'Priority Support',
                description: 'Get help faster when you need it',
              },
              {
                icon: Star,
                title: 'Exclusive Badge',
                description: 'Show off your premium status',
              },
            ].map((benefit, idx) => (
              <div key={idx} className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and digital wallets through Stripe.',
              },
              {
                q: 'Is there a free trial?',
                a: 'We offer a 7-day free trial for new Premium subscribers. Cancel anytime during the trial to avoid being charged.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
