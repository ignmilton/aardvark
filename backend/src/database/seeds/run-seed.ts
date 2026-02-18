import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import dataSource from "../data-source";
import { User, Tag, CreditBundle, SubscriptionPlan } from "../entities";
import {
  UserRole,
  AccountStatus,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionInterval,
} from "@aardvark/shared";

const SALT_ROUNDS = 12;

/**
 * Database seed script - creates only system-required data.
 *
 * Per PRODUCTION_ARCHITECTURE.md Section 9:
 * "Sample/demo stories should NOT be created via hardcoded seed files."
 *
 * This seed only creates:
 * - System users (admin, moderator, test accounts)
 * - Tags (genre/theme categories)
 * - System settings would go here if needed
 *
 * Demo content should be created through the API by admins.
 */
async function seed(ds: DataSource) {
  console.log("🌱 Starting database seed...");
  console.log(
    "📋 Creating system data only (no hardcoded stories per design spec)",
  );

  const userRepo = ds.getRepository(User);
  const tagRepo = ds.getRepository(Tag);

  // --- Users ---
  console.log("Creating users...");
  const passwordHash = await bcrypt.hash("Password123!", SALT_ROUNDS);

  const admin = userRepo.create({
    username: "admin",
    email: "admin@aardvark.dev",
    passwordHash,
    displayName: "Platform Admin",
    role: UserRole.ADMIN,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    creditsBalance: 1000,
    bio: "Platform administrator.",
    emailVerified: true,
  });

  const moderator = userRepo.create({
    username: "moderator",
    email: "mod@aardvark.dev",
    passwordHash,
    displayName: "Content Moderator",
    role: UserRole.MODERATOR,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.NONE,
    creditsBalance: 500,
    bio: "Community moderator keeping things safe.",
    emailVerified: true,
  });

  const author = userRepo.create({
    username: "storywriter",
    email: "author@aardvark.dev",
    passwordHash,
    displayName: "Jane Storyteller",
    role: UserRole.AUTHOR,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    creditsBalance: 200,
    bio: "Interactive fiction enthusiast and author of branching narratives.",
    emailVerified: true,
  });

  const reader = userRepo.create({
    username: "booklover",
    email: "reader@aardvark.dev",
    passwordHash,
    displayName: "Alex Reader",
    role: UserRole.READER,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.NONE,
    creditsBalance: 50,
    bio: "Love reading interactive stories!",
    emailVerified: true,
  });

  const reader2 = userRepo.create({
    username: "adventurer",
    email: "reader2@aardvark.dev",
    passwordHash,
    displayName: "Sam Explorer",
    role: UserRole.READER,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.NONE,
    creditsBalance: 30,
    bio: "Always looking for the next adventure.",
    emailVerified: true,
  });

  const savedUsers = await userRepo.save([
    admin,
    moderator,
    author,
    reader,
    reader2,
  ]);
  console.log(`  Created ${savedUsers.length} users`);

  // --- Tags ---
  console.log("Creating tags...");
  const tagsData = [
    {
      name: "Fantasy",
      slug: "fantasy",
      type: "genre",
      description: "Magic, mythical creatures, and otherworldly settings",
    },
    {
      name: "Sci-Fi",
      slug: "sci-fi",
      type: "genre",
      description: "Futuristic technology, space exploration, and science",
    },
    {
      name: "Mystery",
      slug: "mystery",
      type: "genre",
      description: "Puzzles, detective work, and suspense",
    },
    {
      name: "Romance",
      slug: "romance",
      type: "genre",
      description: "Love stories and relationships",
    },
    {
      name: "Horror",
      slug: "horror",
      type: "genre",
      description: "Fear, suspense, and the supernatural",
    },
    {
      name: "Thriller",
      slug: "thriller",
      type: "genre",
      description: "Fast-paced tension and excitement",
    },
    {
      name: "Adventure",
      slug: "adventure",
      type: "theme",
      description: "Exploration and quests",
    },
    {
      name: "Coming of Age",
      slug: "coming-of-age",
      type: "theme",
      description: "Growth and self-discovery",
    },
    {
      name: "Dystopian",
      slug: "dystopian",
      type: "theme",
      description: "Dark futures and societal collapse",
    },
    {
      name: "Time Travel",
      slug: "time-travel",
      type: "theme",
      description: "Journeys through time",
    },
  ];

  const tagEntities = tagsData.map((t) => tagRepo.create(t as any));
  const savedTags = await tagRepo.save(tagEntities as any);
  console.log(`  Created ${savedTags.length} tags`);

  // --- Credit Bundles ---
  console.log("Creating credit bundles...");
  const bundleRepo = ds.getRepository(CreditBundle);

  const bundlesData = [
    {
      name: "Starter Pack",
      credits: 100,
      priceInCents: 499,
      currency: "usd",
      stripePriceId:
        process.env.STRIPE_PRICE_STARTER_100 || "price_starter_100",
      bonusCredits: 0,
      isPopular: false,
      isActive: true,
    },
    {
      name: "Popular Pack",
      credits: 500,
      priceInCents: 1999,
      currency: "usd",
      stripePriceId:
        process.env.STRIPE_PRICE_POPULAR_500 || "price_popular_500",
      bonusCredits: 50,
      isPopular: true,
      isActive: true,
    },
    {
      name: "Value Pack",
      credits: 1000,
      priceInCents: 3499,
      currency: "usd",
      stripePriceId: process.env.STRIPE_PRICE_VALUE_1000 || "price_value_1000",
      bonusCredits: 150,
      isPopular: false,
      isActive: true,
    },
    {
      name: "Starter Pack (INR)",
      credits: 100,
      priceInCents: 39900,
      currency: "inr",
      stripePriceId:
        process.env.STRIPE_PRICE_STARTER_100_INR || "price_starter_100_inr",
      bonusCredits: 0,
      isPopular: false,
      isActive: true,
    },
    {
      name: "Popular Pack (INR)",
      credits: 500,
      priceInCents: 159900,
      currency: "inr",
      stripePriceId:
        process.env.STRIPE_PRICE_POPULAR_500_INR || "price_popular_500_inr",
      bonusCredits: 50,
      isPopular: true,
      isActive: true,
    },
    {
      name: "Value Pack (INR)",
      credits: 1000,
      priceInCents: 279900,
      currency: "inr",
      stripePriceId:
        process.env.STRIPE_PRICE_VALUE_1000_INR || "price_value_1000_inr",
      bonusCredits: 150,
      isPopular: false,
      isActive: true,
    },
  ];

  const bundleEntities = bundlesData.map((b) => bundleRepo.create(b));
  const savedBundles = await bundleRepo.save(bundleEntities);
  console.log(`  Created ${savedBundles.length} credit bundles`);

  // --- Subscription Plans ---
  console.log("Creating subscription plans...");
  const planRepo = ds.getRepository(SubscriptionPlan);

  const plansData = [
    {
      tier: SubscriptionTier.PREMIUM,
      interval: SubscriptionInterval.MONTHLY,
      name: "Premium Monthly",
      description:
        "Ad-free experience, unlimited premium stories, and 100 bonus credits monthly.",
      priceInCents: 999,
      currency: "usd",
      stripePriceId:
        process.env.STRIPE_PRICE_PREMIUM_MONTHLY || "price_premium_monthly",
      features: [
        "Ad-free reading experience",
        "Unlimited access to premium stories",
        "100 bonus credits every month",
        "Priority support",
        "Early access to new features",
      ],
      isActive: true,
    },
    {
      tier: SubscriptionTier.PREMIUM,
      interval: SubscriptionInterval.YEARLY,
      name: "Premium Yearly",
      description:
        "Everything in Premium Monthly — save 17% with annual billing.",
      priceInCents: 9999,
      currency: "usd",
      stripePriceId:
        process.env.STRIPE_PRICE_PREMIUM_YEARLY || "price_premium_yearly",
      features: [
        "Ad-free reading experience",
        "Unlimited access to premium stories",
        "100 bonus credits every month",
        "Priority support",
        "Early access to new features",
        "Save 17% vs monthly",
      ],
      isActive: true,
    },
  ];

  const planEntities = plansData.map((p) => planRepo.create(p));
  const savedPlans = await planRepo.save(planEntities);
  console.log(`  Created ${savedPlans.length} subscription plans`);

  console.log("\n✅ Seed completed successfully!");
  console.log("\n📝 Note: No sample stories created per design spec.");
  console.log("   Admins should create demo content via API after deployment.");
  // SECURITY: Never log passwords - refer to secure documentation for credentials
  console.log(
    "\nTest accounts created (see secure documentation for credentials):",
  );
  console.log("  admin@aardvark.dev     (admin)");
  console.log("  mod@aardvark.dev       (moderator)");
  console.log("  author@aardvark.dev    (author, premium)");
  console.log("  reader@aardvark.dev    (reader)");
  console.log("  reader2@aardvark.dev   (reader)");
}

async function main() {
  try {
    await dataSource.initialize();
    console.log("Database connection established.");

    // Clear existing data (development only)
    if (process.env.NODE_ENV !== "production") {
      console.log("Clearing existing data...");
      await dataSource.synchronize(true); // drops and recreates all tables
    }

    await seed(dataSource);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();
