import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

// Mock Stripe
const mockStripe = {
  customers: {
    list: jest.fn(),
    create: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  subscriptions: {
    create: jest.fn(),
    cancel: jest.fn(),
    update: jest.fn(),
    retrieve: jest.fn(),
  },
  setupIntents: {
    create: jest.fn(),
  },
  paymentMethods: {
    list: jest.fn(),
    detach: jest.fn(),
  },
  accounts: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  accountLinks: {
    create: jest.fn(),
  },
  transfers: {
    create: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  balance: {
    retrieve: jest.fn(),
  },
};

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockStripe),
  };
});

describe("PaymentsService", () => {
  let service: PaymentsService;
  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "STRIPE_SECRET_KEY") return "sk_test_xxx";
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe("getOrCreateCustomer", () => {
    it("should return existing customer if found", async () => {
      const existingCustomer = { id: "cus_123", email: "test@example.com" };
      mockStripe.customers.list.mockResolvedValue({ data: [existingCustomer] });

      const result = await service.getOrCreateCustomer(
        "user-123",
        "test@example.com",
      );

      expect(result).toEqual(existingCustomer);
      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: "test@example.com",
        limit: 1,
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it("should create new customer if not found", async () => {
      const newCustomer = { id: "cus_456", email: "new@example.com" };
      mockStripe.customers.list.mockResolvedValue({ data: [] });
      mockStripe.customers.create.mockResolvedValue(newCustomer);

      const result = await service.getOrCreateCustomer(
        "user-456",
        "new@example.com",
        "Test User",
      );

      expect(result).toEqual(newCustomer);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: "new@example.com",
        name: "Test User",
        metadata: { userId: "user-456" },
      });
    });
  });

  describe("createPaymentIntent", () => {
    it("should create payment intent with correct parameters", async () => {
      const paymentIntent = { id: "pi_123", amount: 1000 };
      mockStripe.paymentIntents.create.mockResolvedValue(paymentIntent);

      const result = await service.createPaymentIntent("cus_123", 1000, "usd", {
        bundleId: "bundle-1",
      });

      expect(result).toEqual(paymentIntent);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: "usd",
        customer: "cus_123",
        automatic_payment_methods: { enabled: true },
        metadata: { bundleId: "bundle-1" },
      });
    });
  });

  describe("createCreditCheckoutSession", () => {
    it("should create checkout session for credit purchase", async () => {
      const session = { id: "cs_123", url: "https://checkout.stripe.com/xxx" };
      mockStripe.checkout.sessions.create.mockResolvedValue(session);

      const result = await service.createCreditCheckoutSession(
        "cus_123",
        "price_123",
        "user-123",
        "bundle-123",
        "https://success.com",
        "https://cancel.com",
      );

      expect(result).toEqual(session);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        mode: "payment",
        line_items: [{ price: "price_123", quantity: 1 }],
        success_url: "https://success.com",
        cancel_url: "https://cancel.com",
        metadata: {
          userId: "user-123",
          bundleId: "bundle-123",
          type: "credit_purchase",
        },
      });
    });
  });

  describe("createSubscriptionCheckoutSession", () => {
    it("should create subscription checkout session", async () => {
      const session = {
        id: "cs_sub_123",
        url: "https://checkout.stripe.com/sub",
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(session);

      const result = await service.createSubscriptionCheckoutSession(
        "cus_123",
        "price_sub_123",
        "user-123",
        "plan-123",
        "https://success.com",
        "https://cancel.com",
      );

      expect(result).toEqual(session);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        mode: "subscription",
        line_items: [{ price: "price_sub_123", quantity: 1 }],
        subscription_data: undefined,
        success_url: "https://success.com",
        cancel_url: "https://cancel.com",
        metadata: {
          userId: "user-123",
          planId: "plan-123",
          type: "subscription",
        },
      });
    });

    it("should include trial period if specified", async () => {
      const session = { id: "cs_trial_123" };
      mockStripe.checkout.sessions.create.mockResolvedValue(session);

      await service.createSubscriptionCheckoutSession(
        "cus_123",
        "price_123",
        "user-123",
        "plan-123",
        "https://success.com",
        "https://cancel.com",
        14,
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: { trial_period_days: 14 },
        }),
      );
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription immediately when requested", async () => {
      const canceledSub = { id: "sub_123", status: "canceled" };
      mockStripe.subscriptions.cancel.mockResolvedValue(canceledSub);

      const result = await service.cancelSubscription("sub_123", true);

      expect(result).toEqual(canceledSub);
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith("sub_123");
    });

    it("should cancel at period end when not immediate", async () => {
      const updatedSub = { id: "sub_123", cancel_at_period_end: true };
      mockStripe.subscriptions.update.mockResolvedValue(updatedSub);

      const result = await service.cancelSubscription("sub_123", false);

      expect(result).toEqual(updatedSub);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });
    });
  });

  describe("resumeSubscription", () => {
    it("should resume a canceled subscription", async () => {
      const resumedSub = { id: "sub_123", cancel_at_period_end: false };
      mockStripe.subscriptions.update.mockResolvedValue(resumedSub);

      const result = await service.resumeSubscription("sub_123");

      expect(result).toEqual(resumedSub);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: false,
      });
    });
  });

  describe("createSetupIntent", () => {
    it("should create setup intent for saving payment methods", async () => {
      const setupIntent = { id: "seti_123", client_secret: "secret_xxx" };
      mockStripe.setupIntents.create.mockResolvedValue(setupIntent);

      const result = await service.createSetupIntent("cus_123");

      expect(result).toEqual(setupIntent);
      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith({
        customer: "cus_123",
        automatic_payment_methods: { enabled: true },
      });
    });
  });

  describe("listPaymentMethods", () => {
    it("should list payment methods for customer", async () => {
      const methods = [{ id: "pm_123", type: "card" }];
      mockStripe.paymentMethods.list.mockResolvedValue({ data: methods });

      const result = await service.listPaymentMethods("cus_123");

      expect(result).toEqual(methods);
      expect(mockStripe.paymentMethods.list).toHaveBeenCalledWith({
        customer: "cus_123",
        type: "card",
      });
    });
  });

  describe("detachPaymentMethod", () => {
    it("should detach payment method", async () => {
      const detachedMethod = { id: "pm_123" };
      mockStripe.paymentMethods.detach.mockResolvedValue(detachedMethod);

      const result = await service.detachPaymentMethod("pm_123");

      expect(result).toEqual(detachedMethod);
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith("pm_123");
    });
  });

  describe("Stripe Connect", () => {
    describe("createConnectAccount", () => {
      it("should create express connect account", async () => {
        const account = { id: "acct_123", type: "express" };
        mockStripe.accounts.create.mockResolvedValue(account);

        const result = await service.createConnectAccount(
          "author-123",
          "author@example.com",
          "US",
        );

        expect(result).toEqual(account);
        expect(mockStripe.accounts.create).toHaveBeenCalledWith({
          type: "express",
          country: "US",
          email: "author@example.com",
          business_type: "individual",
          capabilities: { transfers: { requested: true } },
          metadata: { authorId: "author-123" },
        });
      });
    });

    describe("createConnectAccountLink", () => {
      it("should create account link for onboarding", async () => {
        const link = { url: "https://connect.stripe.com/onboarding" };
        mockStripe.accountLinks.create.mockResolvedValue(link);

        const result = await service.createConnectAccountLink(
          "acct_123",
          "https://refresh.com",
          "https://return.com",
        );

        expect(result).toEqual(link);
        expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
          account: "acct_123",
          refresh_url: "https://refresh.com",
          return_url: "https://return.com",
          type: "account_onboarding",
        });
      });
    });

    describe("createTransfer", () => {
      it("should create transfer to connected account", async () => {
        const transfer = { id: "tr_123", amount: 5000 };
        mockStripe.transfers.create.mockResolvedValue(transfer);

        const result = await service.createTransfer(
          5000,
          "acct_123",
          "Author payout",
          { payoutId: "payout-123" },
        );

        expect(result).toEqual(transfer);
        expect(mockStripe.transfers.create).toHaveBeenCalledWith({
          amount: 5000,
          currency: "usd",
          destination: "acct_123",
          description: "Author payout",
          metadata: { payoutId: "payout-123" },
        });
      });
    });
  });

  describe("constructWebhookEvent", () => {
    it("should construct and verify webhook event", () => {
      const event = { id: "evt_123", type: "checkout.session.completed" };
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = service.constructWebhookEvent(
        "payload",
        "sig_xxx",
        "whsec_xxx",
      );

      expect(result).toEqual(event);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        "payload",
        "sig_xxx",
        "whsec_xxx",
      );
    });

    it("should throw BadRequestException on invalid signature", () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      expect(() =>
        service.constructWebhookEvent("payload", "bad_sig", "whsec_xxx"),
      ).toThrow(BadRequestException);
    });
  });

  describe("createRefund", () => {
    it("should create refund for payment intent", async () => {
      const refund = { id: "re_123", amount: 1000 };
      mockStripe.refunds.create.mockResolvedValue(refund);

      const result = await service.createRefund(
        "pi_123",
        1000,
        "requested_by_customer",
      );

      expect(result).toEqual(refund);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: "pi_123",
        amount: 1000,
        reason: "requested_by_customer",
      });
    });
  });

  describe("getBalance", () => {
    it("should retrieve platform balance", async () => {
      const balance = { available: [{ amount: 10000, currency: "usd" }] };
      mockStripe.balance.retrieve.mockResolvedValue(balance);

      const result = await service.getBalance();

      expect(result).toEqual(balance);
      expect(mockStripe.balance.retrieve).toHaveBeenCalled();
    });
  });
});
