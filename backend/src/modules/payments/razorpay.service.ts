import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import {
  UPIPaymentOrder,
  AuthorPayoutAccount,
  Payout,
  CreditBundle,
  User,
} from "@/database/entities";
import { MIN_UPI_PAYOUT_AMOUNT_PAISE } from "@aardvark/shared";

/**
 * Razorpay API response types
 */
interface RazorpayOrder {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes: Record<string, string>;
  created_at: number;
}

interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  vpa: string | null;
  order_id: string;
  captured: boolean;
  error_code: string | null;
  error_description: string | null;
}

interface RazorpayContact {
  id: string;
  entity: "contact";
  name: string;
  email: string;
  type: string;
  active: boolean;
}

interface RazorpayFundAccount {
  id: string;
  entity: "fund_account";
  contact_id: string;
  account_type: "vpa";
  vpa: {
    address: string;
  };
  active: boolean;
}

interface RazorpayPayout {
  id: string;
  entity: "payout";
  fund_account_id: string;
  amount: number;
  currency: string;
  status:
    | "queued"
    | "pending"
    | "processing"
    | "processed"
    | "reversed"
    | "cancelled"
    | "failed";
  purpose: string;
  utr: string | null;
  mode: string;
  failure_reason: string | null;
  created_at: number;
}

/**
 * Razorpay service for UPI payments and payouts in India.
 * Handles:
 * - Creating payment orders for credit purchases
 * - Verifying payment signatures
 * - Creating contacts and fund accounts for author payouts
 * - Processing UPI payouts to authors via Razorpay X
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = "https://api.razorpay.com/v1";
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UPIPaymentOrder)
    private readonly orderRepository: Repository<UPIPaymentOrder>,
    @InjectRepository(AuthorPayoutAccount)
    private readonly payoutAccountRepository: Repository<AuthorPayoutAccount>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(CreditBundle)
    private readonly bundleRepository: Repository<CreditBundle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const keyId = this.configService.get<string>("razorpay.keyId") || this.configService.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.configService.get<string>("razorpay.keySecret") || this.configService.get<string>("RAZORPAY_KEY_SECRET");
    const webhookSecret = this.configService.get<string>("razorpay.webhookSecret") || this.configService.get<string>("RAZORPAY_WEBHOOK_SECRET");

    if (!keyId || !keySecret || !webhookSecret) {
      this.logger.warn(
        "Razorpay credentials not configured. UPI payments will be unavailable. " +
        "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET to enable.",
      );
      this.keyId = "";
      this.keySecret = "";
      this.webhookSecret = "";
      this.enabled = false;
      return;
    }

    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
    this.enabled = true;
  }

  /**
   * Check if Razorpay is configured and available
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Throw if Razorpay is not configured
   */
  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new BadRequestException(
        "UPI payments are not available. Razorpay is not configured.",
      );
    }
  }

  /**
   * Get authorization header for Razorpay API
   */
  private getAuthHeader(): string {
    return (
      "Basic " +
      Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")
    );
  }

  /**
   * Make authenticated request to Razorpay API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PATCH" = "GET",
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // SECURITY: Only log error code and description, not full response which may contain sensitive data
      const errorCode = data.error?.code || "UNKNOWN";
      const errorDesc = data.error?.description || "Unknown error";
      this.logger.error(`Razorpay API error: ${errorCode} - ${errorDesc}`);
      throw new BadRequestException(errorDesc);
    }

    return data as T;
  }

  // ============================================================================
  // Payment Orders (User to Platform)
  // ============================================================================

  /**
   * Create a Razorpay order for credit bundle purchase
   */
  async createOrder(
    userId: string,
    bundleId: string,
  ): Promise<{ order: UPIPaymentOrder; razorpayKeyId: string }> {
    this.ensureEnabled();

    const bundle = await this.bundleRepository.findOne({
      where: { id: bundleId, isActive: true, currency: "inr" },
    });

    if (!bundle) {
      throw new BadRequestException("INR bundle not found");
    }

    const receipt = `rcpt_${Date.now()}_${userId.slice(0, 8)}`;

    // Create order with Razorpay
    const razorpayOrder = await this.makeRequest<RazorpayOrder>(
      "/orders",
      "POST",
      {
        amount: bundle.priceInCents, // Already in paise for INR bundles
        currency: "INR",
        receipt,
        notes: {
          userId,
          bundleId,
          purpose: "credit_purchase",
        },
      },
    );

    // Save order to database
    const order = this.orderRepository.create({
      razorpayOrderId: razorpayOrder.id,
      userId,
      amountInPaise: bundle.priceInCents,
      currency: "INR",
      status: "created",
      purpose: "credit_purchase",
      referenceId: bundleId,
      receipt,
      notes: { bundleId },
    });

    const savedOrder = await this.orderRepository.save(order);

    return {
      order: savedOrder,
      razorpayKeyId: this.keyId,
    };
  }

  /**
   * Verify payment signature and update order status
   */
  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<UPIPaymentOrder> {
    this.ensureEnabled();

    // Verify signature using constant-time comparison to prevent timing attacks
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", this.keySecret)
      .update(body)
      .digest("hex");

    if (!this.safeCompare(expectedSignature, razorpaySignature)) {
      throw new BadRequestException("Invalid payment signature");
    }

    // Get payment details from Razorpay
    const payment = await this.makeRequest<RazorpayPayment>(
      `/payments/${razorpayPaymentId}`,
    );

    // Find and update order
    const order = await this.orderRepository.findOne({
      where: { razorpayOrderId },
    });

    if (!order) {
      throw new BadRequestException("Order not found");
    }

    order.razorpayPaymentId = razorpayPaymentId;
    order.status = payment.status === "captured" ? "captured" : payment.status;
    order.vpa = payment.vpa;
    order.method = payment.method;
    order.paidAt = new Date();

    return this.orderRepository.save(order);
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId: string): Promise<RazorpayPayment> {
    this.ensureEnabled();
    return this.makeRequest<RazorpayPayment>(`/payments/${paymentId}`);
  }

  /**
   * Capture a payment (if not auto-captured)
   */
  async capturePayment(
    paymentId: string,
    amount: number,
  ): Promise<RazorpayPayment> {
    this.ensureEnabled();
    return this.makeRequest<RazorpayPayment>(
      `/payments/${paymentId}/capture`,
      "POST",
      {
        amount,
        currency: "INR",
      },
    );
  }

  // ============================================================================
  // Payouts (Platform to Author via Razorpay X)
  // ============================================================================

  /**
   * Create a Razorpay X contact for an author
   */
  async createContact(
    authorId: string,
    name: string,
    email: string,
  ): Promise<RazorpayContact> {
    return this.makeRequest<RazorpayContact>("/contacts", "POST", {
      name,
      email,
      type: "vendor",
      reference_id: authorId,
      notes: {
        authorId,
        platform: "aardvark",
      },
    });
  }

  /**
   * Create a UPI fund account for an author
   */
  async createFundAccount(
    contactId: string,
    upiVpa: string,
  ): Promise<RazorpayFundAccount> {
    return this.makeRequest<RazorpayFundAccount>("/fund_accounts", "POST", {
      contact_id: contactId,
      account_type: "vpa",
      vpa: {
        address: upiVpa,
      },
    });
  }

  /**
   * Set up author's UPI payout account
   */
  async setupAuthorUPIAccount(
    authorId: string,
    upiVpa: string,
    accountHolderName: string,
  ): Promise<AuthorPayoutAccount> {
    this.ensureEnabled();

    // Validate UPI VPA format (basic validation)
    const upiRegex = /^[\w.-]+@[\w]+$/;
    if (!upiRegex.test(upiVpa)) {
      throw new BadRequestException("Invalid UPI VPA format");
    }

    const user = await this.userRepository.findOne({ where: { id: authorId } });
    if (!user) {
      throw new BadRequestException("User not found");
    }

    // Check for existing account
    let account = await this.payoutAccountRepository.findOne({
      where: { authorId },
    });

    // Create Razorpay contact
    const contact = await this.createContact(
      authorId,
      accountHolderName,
      user.email,
    );

    // Create UPI fund account
    const fundAccount = await this.createFundAccount(contact.id, upiVpa);

    if (account) {
      // Update existing account
      account.upiVpa = upiVpa;
      account.upiAccountHolderName = accountHolderName;
      account.razorpayContactId = contact.id;
      account.razorpayFundAccountId = fundAccount.id;
      account.upiVerified = true;
      account.payoutsEnabled = true;
      account.updatedAt = new Date();
    } else {
      // Create new account
      account = this.payoutAccountRepository.create({
        authorId,
        country: "IN",
        currency: "inr",
        upiVpa,
        upiAccountHolderName: accountHolderName,
        razorpayContactId: contact.id,
        razorpayFundAccountId: fundAccount.id,
        upiVerified: true,
        payoutsEnabled: true,
        accountStatus: "active",
        updatedAt: new Date(),
      });
    }

    return this.payoutAccountRepository.save(account);
  }

  /**
   * Create a UPI payout to an author
   */
  async createPayout(
    authorId: string,
    amountInPaise: number,
    narration: string = "Aardvark author earnings payout",
  ): Promise<Payout> {
    this.ensureEnabled();

    if (amountInPaise < MIN_UPI_PAYOUT_AMOUNT_PAISE) {
      throw new BadRequestException(
        `Minimum payout amount is ₹${MIN_UPI_PAYOUT_AMOUNT_PAISE / 100}`,
      );
    }

    const account = await this.payoutAccountRepository.findOne({
      where: { authorId },
    });

    if (!account || !account.razorpayFundAccountId || !account.upiVpa) {
      throw new BadRequestException("Author UPI payout account not configured");
    }

    if (!account.payoutsEnabled) {
      throw new BadRequestException("Payouts are not enabled for this account");
    }

    // Create payout via Razorpay X
    const razorpayPayout = await this.makeRequest<RazorpayPayout>(
      "/payouts",
      "POST",
      {
        account_number: this.configService.get<string>(
          "RAZORPAY_ACCOUNT_NUMBER",
        ),
        fund_account_id: account.razorpayFundAccountId,
        amount: amountInPaise,
        currency: "INR",
        mode: "UPI",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: `payout_${authorId}_${Date.now()}`,
        narration,
      },
    );

    // Create payout record
    const payout = this.payoutRepository.create({
      authorId,
      amount: amountInPaise,
      currency: "INR",
      paymentMethod: "upi",
      status: this.mapRazorpayPayoutStatus(razorpayPayout.status),
      razorpayPayoutId: razorpayPayout.id,
      upiVpa: account.upiVpa,
      utr: razorpayPayout.utr,
    });

    return this.payoutRepository.save(payout);
  }

  /**
   * Map Razorpay payout status to our status
   */
  private mapRazorpayPayoutStatus(
    status: RazorpayPayout["status"],
  ): Payout["status"] {
    const statusMap: Record<RazorpayPayout["status"], Payout["status"]> = {
      queued: "pending",
      pending: "pending",
      processing: "processing",
      processed: "completed",
      reversed: "reversed",
      cancelled: "failed",
      failed: "failed",
    };
    return statusMap[status];
  }

  /**
   * Get payout status from Razorpay
   */
  async getPayoutStatus(payoutId: string): Promise<RazorpayPayout> {
    return this.makeRequest<RazorpayPayout>(`/payouts/${payoutId}`);
  }

  /**
   * Update payout status from webhook
   */
  async updatePayoutStatus(razorpayPayoutId: string): Promise<Payout | null> {
    const payout = await this.payoutRepository.findOne({
      where: { razorpayPayoutId },
    });

    if (!payout) {
      return null;
    }

    const razorpayPayout = await this.getPayoutStatus(razorpayPayoutId);

    payout.status = this.mapRazorpayPayoutStatus(razorpayPayout.status);
    payout.utr = razorpayPayout.utr;

    if (razorpayPayout.status === "processed") {
      payout.completedAt = new Date();
    } else if (razorpayPayout.status === "failed") {
      payout.failureReason = razorpayPayout.failure_reason;
    }

    payout.processedAt = new Date();

    return this.payoutRepository.save(payout);
  }

  // ============================================================================
  // Webhooks
  // ============================================================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.enabled) return false;
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(body)
      .digest("hex");

    return this.safeCompare(expectedSignature, signature);
  }

  /**
   * Constant-time string comparison to prevent timing attacks on HMAC verification.
   */
  private safeCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<{ handled: boolean }> {
    this.logger.log(`Processing Razorpay webhook: ${event}`);

    const payloadData = payload as Record<string, any>;

    switch (event) {
      case "payment.captured": {
        // Payment successful - credits should be added
        const paymentEntity = payloadData.payment?.entity as
          | RazorpayPayment
          | undefined;
        if (paymentEntity) {
          const order = await this.orderRepository.findOne({
            where: { razorpayOrderId: paymentEntity.order_id },
          });
          if (order) {
            order.status = "captured";
            order.razorpayPaymentId = paymentEntity.id;
            order.method = paymentEntity.method;
            order.vpa = paymentEntity.vpa;
            order.paidAt = new Date();
            await this.orderRepository.save(order);
          }
        }
        break;
      }

      case "payment.failed": {
        const failedPayment = payloadData.payment?.entity as
          | RazorpayPayment
          | undefined;
        if (failedPayment) {
          const order = await this.orderRepository.findOne({
            where: { razorpayOrderId: failedPayment.order_id },
          });
          if (order) {
            order.status = "failed";
            order.razorpayPaymentId = failedPayment.id;
            await this.orderRepository.save(order);
          }
        }
        break;
      }

      case "payout.processed":
      case "payout.failed":
      case "payout.reversed": {
        const payoutEntity = payloadData.payout?.entity as
          | RazorpayPayout
          | undefined;
        if (payoutEntity) {
          await this.updatePayoutStatus(payoutEntity.id);
        }
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event: ${event}`);
    }

    return { handled: true };
  }

  /**
   * Get author's payout account details
   */
  async getAuthorPayoutAccount(
    authorId: string,
  ): Promise<AuthorPayoutAccount | null> {
    return this.payoutAccountRepository.findOne({
      where: { authorId },
    });
  }

  /**
   * Get payout history for an author
   */
  async getPayoutHistory(authorId: string): Promise<Payout[]> {
    return this.payoutRepository.find({
      where: { authorId },
      order: { requestedAt: "DESC" },
      take: 50,
    });
  }

  /**
   * Get Razorpay key ID for frontend
   */
  getKeyId(): string {
    this.ensureEnabled();
    return this.keyId;
  }
}
