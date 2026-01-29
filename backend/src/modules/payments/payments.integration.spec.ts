/**
 * Integration tests for Payments Service with Stripe Test Mode
 *
 * These tests require STRIPE_TEST_SECRET_KEY environment variable to be set.
 * They test actual Stripe API calls in test mode.
 *
 * Run with: STRIPE_TEST_SECRET_KEY=sk_test_xxx npm run test -- payments.integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

const STRIPE_TEST_KEY = process.env.STRIPE_TEST_SECRET_KEY;

// Skip these tests if no test key is available
const describeIfStripeKey = STRIPE_TEST_KEY ? describe : describe.skip;

describeIfStripeKey('PaymentsService Integration (Stripe Test Mode)', () => {
  let service: PaymentsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return STRIPE_TEST_KEY;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('Customer Management', () => {
    it('should create a new Stripe customer', async () => {
      const customer = await service.getOrCreateCustomer(
        `test-user-${Date.now()}`,
        `test-${Date.now()}@example.com`,
        'Integration Test User',
      );

      expect(customer).toBeDefined();
      expect(customer.id).toMatch(/^cus_/);
      expect(customer.email).toContain('@example.com');
    });

    it('should return existing customer if email matches', async () => {
      const email = `existing-${Date.now()}@example.com`;

      const customer1 = await service.getOrCreateCustomer(
        'user-1',
        email,
        'First User',
      );

      const customer2 = await service.getOrCreateCustomer(
        'user-2',
        email,
        'Second User',
      );

      expect(customer1.id).toBe(customer2.id);
    });
  });

  describe('Payment Intents', () => {
    let customerId: string;

    beforeAll(async () => {
      const customer = await service.getOrCreateCustomer(
        `payment-test-${Date.now()}`,
        `payment-${Date.now()}@example.com`,
        'Payment Test User',
      );
      customerId = customer.id;
    });

    it('should create a payment intent', async () => {
      const paymentIntent = await service.createPaymentIntent(
        customerId,
        1000, // $10.00
        'usd',
        { type: 'test', userId: 'test-123' },
      );

      expect(paymentIntent).toBeDefined();
      expect(paymentIntent.id).toMatch(/^pi_/);
      expect(paymentIntent.amount).toBe(1000);
      expect(paymentIntent.currency).toBe('usd');
      expect(paymentIntent.status).toBe('requires_payment_method');
    });

    it('should create payment intent with different currencies', async () => {
      const eurIntent = await service.createPaymentIntent(customerId, 500, 'eur');
      expect(eurIntent.currency).toBe('eur');

      const gbpIntent = await service.createPaymentIntent(customerId, 500, 'gbp');
      expect(gbpIntent.currency).toBe('gbp');
    });
  });

  describe('Setup Intents', () => {
    let customerId: string;

    beforeAll(async () => {
      const customer = await service.getOrCreateCustomer(
        `setup-test-${Date.now()}`,
        `setup-${Date.now()}@example.com`,
        'Setup Test User',
      );
      customerId = customer.id;
    });

    it('should create a setup intent for saving payment methods', async () => {
      const setupIntent = await service.createSetupIntent(customerId);

      expect(setupIntent).toBeDefined();
      expect(setupIntent.id).toMatch(/^seti_/);
      expect(setupIntent.customer).toBe(customerId);
    });
  });

  describe('Balance', () => {
    it('should retrieve platform balance', async () => {
      const balance = await service.getBalance();

      expect(balance).toBeDefined();
      expect(balance.available).toBeDefined();
      expect(balance.pending).toBeDefined();
      expect(Array.isArray(balance.available)).toBe(true);
    });
  });

  describe('Webhook Verification', () => {
    it('should reject invalid webhook signatures', () => {
      const payload = JSON.stringify({ type: 'test.event' });
      const invalidSig = 'invalid_signature';
      const webhookSecret = 'whsec_test_secret';

      expect(() => {
        service.constructWebhookEvent(payload, invalidSig, webhookSecret);
      }).toThrow('Invalid webhook signature');
    });
  });

  describe('Checkout Sessions', () => {
    let customerId: string;

    beforeAll(async () => {
      const customer = await service.getOrCreateCustomer(
        `checkout-test-${Date.now()}`,
        `checkout-${Date.now()}@example.com`,
        'Checkout Test User',
      );
      customerId = customer.id;
    });

    // Note: These tests require valid price IDs from your Stripe dashboard
    it.skip('should create credit checkout session', async () => {
      const session = await service.createCreditCheckoutSession(
        customerId,
        'price_xxx', // Replace with actual test price ID
        'user-123',
        'bundle-123',
        'https://example.com/success',
        'https://example.com/cancel',
      );

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^cs_/);
      expect(session.mode).toBe('payment');
    });

    it.skip('should create subscription checkout session', async () => {
      const session = await service.createSubscriptionCheckoutSession(
        customerId,
        'price_xxx', // Replace with actual test price ID
        'user-123',
        'plan-123',
        'https://example.com/success',
        'https://example.com/cancel',
        7, // 7-day trial
      );

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^cs_/);
      expect(session.mode).toBe('subscription');
    });
  });

  describe('Connect (Author Payouts)', () => {
    // Note: Connect tests require additional Stripe Connect setup
    it.skip('should create Connect Express account', async () => {
      const account = await service.createConnectAccount(
        `author-${Date.now()}`,
        `author-${Date.now()}@example.com`,
        'US',
        'individual',
      );

      expect(account).toBeDefined();
      expect(account.id).toMatch(/^acct_/);
      expect(account.type).toBe('express');
    });

    it.skip('should create account onboarding link', async () => {
      // First create an account
      const account = await service.createConnectAccount(
        `author-link-${Date.now()}`,
        `author-link-${Date.now()}@example.com`,
        'US',
        'individual',
      );

      const link = await service.createConnectAccountLink(
        account.id,
        'https://example.com/refresh',
        'https://example.com/return',
      );

      expect(link).toBeDefined();
      expect(link.url).toContain('stripe.com');
    });
  });
});

/**
 * Test helpers for simulating Stripe webhook events
 */
export const createTestWebhookEvent = (type: string, data: Record<string, any> = {}) => ({
  id: `evt_test_${Date.now()}`,
  object: 'event',
  type,
  data: {
    object: data,
  },
  created: Math.floor(Date.now() / 1000),
  livemode: false,
});

export const testWebhookEvents = {
  checkoutCompleted: createTestWebhookEvent('checkout.session.completed', {
    id: 'cs_test_123',
    mode: 'payment',
    payment_status: 'paid',
    metadata: {
      userId: 'user-123',
      bundleId: 'bundle-123',
      type: 'credit_purchase',
    },
  }),

  subscriptionCreated: createTestWebhookEvent('customer.subscription.created', {
    id: 'sub_test_123',
    status: 'active',
    customer: 'cus_test_123',
    metadata: {
      userId: 'user-123',
    },
  }),

  subscriptionDeleted: createTestWebhookEvent('customer.subscription.deleted', {
    id: 'sub_test_123',
    status: 'canceled',
    customer: 'cus_test_123',
  }),

  paymentFailed: createTestWebhookEvent('invoice.payment_failed', {
    id: 'in_test_123',
    subscription: 'sub_test_123',
    customer: 'cus_test_123',
  }),

  transferCreated: createTestWebhookEvent('transfer.created', {
    id: 'tr_test_123',
    amount: 5000,
    destination: 'acct_test_123',
    metadata: {
      authorId: 'author-123',
      payoutId: 'payout-123',
    },
  }),
};
