/**
 * Monetization and credit system type definitions for Aardvark Platform
 * Handles credits, subscriptions, payments, ads, and author earnings
 */

// ============================================================================
// Credit System
// ============================================================================

export enum TransactionType {
  // Credit earning
  AD_WATCH = 'ad_watch',
  AD_REWARD = 'ad_reward', // Credits awarded for watching rewarded ads
  DAILY_BONUS = 'daily_bonus',
  STORY_COMPLETION = 'story_completion',
  REVIEW_REWARD = 'review_reward',
  REFERRAL_BONUS = 'referral_bonus',
  PROMOTIONAL = 'promotional',

  // Credit spending
  STORY_UNLOCK = 'story_unlock',
  AI_COMPANION = 'ai_companion',
  AUTHOR_TIP = 'author_tip',

  // Purchases
  CREDIT_PURCHASE = 'credit_purchase',
  SUBSCRIPTION_CREDIT = 'subscription_credit',

  // Admin adjustments
  ADMIN_ADJUSTMENT = 'admin_adjustment',
  REFUND = 'refund',
}

/**
 * Credit transaction record
 */
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // Positive for earning, negative for spending
  balance: number; // Balance after transaction
  description: string;
  referenceId: string | null; // Related entity (story ID, ad ID, etc.)
  referenceType: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Credit earning configuration
 */
export interface CreditConfig {
  adWatchCredits: number; // Credits per ad watched
  adWatchCooldown: number; // Seconds between ad watches
  dailyBonusCredits: number;
  storyCompletionCredits: number;
  reviewRewardCredits: number;
  maxReviewRewardsPerDay: number;
  referralBonusCredits: number;
  aiCompanionCost: number;
}

export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  adWatchCredits: 1,
  adWatchCooldown: 600, // 10 minutes
  dailyBonusCredits: 2,
  storyCompletionCredits: 5,
  reviewRewardCredits: 1,
  maxReviewRewardsPerDay: 5,
  referralBonusCredits: 10,
  aiCompanionCost: 5,
};

// ============================================================================
// Subscription System
// ============================================================================

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
}

export enum SubscriptionInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/**
 * Subscription plan configuration
 */
export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  interval: SubscriptionInterval;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  stripePriceId: string;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User subscription record
 */
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Premium subscription benefits
 */
export interface PremiumBenefits {
  adFree: boolean;
  unlimitedPremiumStories: boolean;
  unlimitedAiCompanion: boolean;
  earlyAccess: boolean;
  premiumBadge: boolean;
  prioritySupport: boolean;
  extendedStorageGb: number;
  monthlyBonusCredits: number;
}

export const PREMIUM_BENEFITS: PremiumBenefits = {
  adFree: true,
  unlimitedPremiumStories: true,
  unlimitedAiCompanion: true,
  earlyAccess: true,
  premiumBadge: true,
  prioritySupport: true,
  extendedStorageGb: 10,
  monthlyBonusCredits: 100,
};

// ============================================================================
// Credit Bundles
// ============================================================================

/**
 * Purchasable credit bundle
 */
export interface CreditBundle {
  id: string;
  name: string;
  credits: number;
  priceInCents: number;
  currency: string;
  stripePriceId: string;
  bonusCredits: number;
  isPopular: boolean;
  isActive: boolean;
  createdAt: Date;
}

export const CREDIT_BUNDLES: Omit<CreditBundle, 'id' | 'stripePriceId' | 'createdAt'>[] = [
  {
    name: 'Starter Pack',
    credits: 100,
    priceInCents: 499,
    currency: 'usd',
    bonusCredits: 0,
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Popular Pack',
    credits: 500,
    priceInCents: 1999,
    currency: 'usd',
    bonusCredits: 50,
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Value Pack',
    credits: 1000,
    priceInCents: 3499,
    currency: 'usd',
    bonusCredits: 150,
    isPopular: false,
    isActive: true,
  },
];

// ============================================================================
// Ad System
// ============================================================================

export enum AdType {
  VIDEO_REWARD = 'video_reward',
  BANNER = 'banner',
  INTERSTITIAL = 'interstitial',
}

export enum AdProvider {
  GOOGLE = 'google',
  CUSTOM = 'custom',
}

/**
 * Ad watch record for credit rewards
 */
export interface AdWatch {
  id: string;
  userId: string;
  adType: AdType;
  adProvider: AdProvider;
  adUnitId: string;
  duration: number; // Seconds
  completed: boolean;
  creditsAwarded: number;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

/**
 * Ad rate limiting per user
 */
export interface AdRateLimit {
  userId: string;
  lastAdAt: Date;
  adsToday: number;
  creditsEarnedToday: number;
}

// ============================================================================
// Author Earnings
// ============================================================================

export enum EarningType {
  STORY_UNLOCK = 'story_unlock',
  TIP = 'tip',
  SUBSCRIPTION_SHARE = 'subscription_share',
}

/**
 * Author earning record
 */
export interface AuthorEarning {
  id: string;
  authorId: string;
  storyId: string | null;
  type: EarningType;
  grossAmount: number; // Credits earned
  platformFee: number; // Platform's cut (30%)
  netAmount: number; // Author's earnings (70%)
  readerUserId: string | null;
  transactionId: string;
  createdAt: Date;
}

/**
 * Aggregated author earnings for a period
 */
export interface AuthorEarningsSummary {
  authorId: string;
  period: 'day' | 'week' | 'month' | 'year' | 'all_time';
  startDate: Date;
  endDate: Date;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  earningsByType: Record<EarningType, number>;
  earningsByStory: { storyId: string; title: string; amount: number }[];
}

/**
 * Payout request to transfer earnings to author's bank
 */
export interface Payout {
  id: string;
  authorId: string;
  amount: number; // In cents
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripeTransferId: string | null;
  stripePayoutId: string | null;
  failureReason: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  completedAt: Date | null;
}

/**
 * Author's connected Stripe account for payouts
 */
export interface AuthorPayoutAccount {
  id: string;
  authorId: string;
  stripeConnectAccountId: string;
  accountStatus: 'pending' | 'active' | 'restricted' | 'disabled';
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  country: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

// Minimum payout threshold in cents
export const MIN_PAYOUT_AMOUNT = 5000; // $50

// Platform revenue share - values defined in constants/index.ts

// ============================================================================
// DTOs
// ============================================================================

export interface WatchAdDto {
  adType: AdType;
  adUnitId: string;
  duration: number;
  completed: boolean;
}

export interface PurchaseCreditsDto {
  bundleId: string;
  paymentMethodId?: string;
}

export interface UnlockStoryDto {
  storyId: string;
}

export interface TipAuthorDto {
  authorId: string;
  storyId?: string;
  amount: number;
  message?: string;
}

export interface CreateSubscriptionDto {
  planId: string;
  paymentMethodId: string;
}

export interface RequestPayoutDto {
  amount?: number; // Optional, defaults to full balance
}

export interface SetupPayoutAccountDto {
  country: string;
  businessType: 'individual' | 'company';
}

// ============================================================================
// UPI Payment System (India)
// ============================================================================

export enum PaymentProvider {
  STRIPE = 'stripe',
  RAZORPAY = 'razorpay',
}

export enum UPIPaymentStatus {
  CREATED = 'created',
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum UPIPayoutStatus {
  QUEUED = 'queued',
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  REVERSED = 'reversed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/**
 * UPI Payment order (for user payments to platform)
 */
export interface UPIPaymentOrder {
  id: string;
  razorpayOrderId: string;
  userId: string;
  amountInPaise: number; // INR in paise
  currency: 'INR';
  status: UPIPaymentStatus;
  purpose: 'credit_purchase' | 'subscription';
  referenceId: string; // bundleId or planId
  razorpayPaymentId: string | null;
  vpa: string | null; // UPI VPA used
  method: string | null; // 'upi', 'card', etc.
  receipt: string;
  notes: Record<string, string>;
  createdAt: Date;
  paidAt: Date | null;
}

/**
 * UPI Payout (platform to author)
 */
export interface UPIPayout {
  id: string;
  razorpayPayoutId: string | null;
  authorId: string;
  amountInPaise: number;
  currency: 'INR';
  status: UPIPayoutStatus;
  vpa: string; // Author's UPI VPA
  purpose: 'payout';
  narration: string;
  referenceId: string;
  utr: string | null; // Unique Transaction Reference
  failureReason: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * Razorpay configuration
 */
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/**
 * UPI Credit bundles in INR
 */
export const CREDIT_BUNDLES_INR: Omit<CreditBundle, 'id' | 'stripePriceId' | 'createdAt'>[] = [
  {
    name: 'Starter Pack',
    credits: 100,
    priceInCents: 9900, // ₹99 in paise
    currency: 'inr',
    bonusCredits: 0,
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Popular Pack',
    credits: 500,
    priceInCents: 39900, // ₹399 in paise
    currency: 'inr',
    bonusCredits: 50,
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Value Pack',
    credits: 1000,
    priceInCents: 69900, // ₹699 in paise
    currency: 'inr',
    bonusCredits: 150,
    isPopular: false,
    isActive: true,
  },
];

// Minimum UPI payout threshold in paise (₹500 = 50000 paise)
export const MIN_UPI_PAYOUT_AMOUNT_PAISE = 50000;

// ============================================================================
// UPI DTOs
// ============================================================================

export interface CreateUPIOrderDto {
  bundleId: string;
}

export interface VerifyUPIPaymentDto {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface SetupUPIPayoutAccountDto {
  upiVpa: string; // e.g., "username@upi", "phone@paytm"
  accountHolderName: string;
}

export interface RequestUPIPayoutDto {
  amount?: number; // Optional, defaults to full balance (in paise)
}

export interface UPIPaymentResponse {
  orderId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  currency: 'INR';
  keyId: string; // Razorpay key for frontend
}

/**
 * Response for credit balance inquiry
 */
export interface CreditBalanceResponse {
  balance: number;
  pendingEarnings: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastTransaction: Transaction | null;
}

/**
 * Response for subscription status
 */
export interface SubscriptionStatusResponse {
  isActive: boolean;
  tier: SubscriptionTier;
  plan: SubscriptionPlan | null;
  subscription: Subscription | null;
  benefits: PremiumBenefits | null;
  renewsAt: Date | null;
  canceledAt: Date | null;
}
