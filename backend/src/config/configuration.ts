/**
 * Application configuration loaded from environment variables.
 * This configuration is loaded at application startup and can be
 * injected into modules using ConfigService.
 */

function requireInProduction(envVar: string, defaultValue: string): string {
  const value = process.env[envVar];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${envVar} must be set in production environment`);
  }
  return defaultValue;
}

export default () => ({
  // Application settings
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  apiUrl: process.env.API_URL || "http://localhost:4000",

  // Database configuration
  database: {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    username: process.env.DATABASE_USER || "aardvark",
    password: process.env.DATABASE_PASSWORD || "aardvark_dev_password",
    database: process.env.DATABASE_NAME || "aardvark",
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || "2", 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Elasticsearch configuration
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },

  // JWT configuration
  jwt: {
    secret: requireInProduction(
      "JWT_SECRET",
      "dev_jwt_secret_change_in_production",
    ),
    refreshSecret: requireInProduction(
      "JWT_REFRESH_SECRET",
      "dev_refresh_secret_change_in_production",
    ),
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || "15m",
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || "7d",
  },

  // S3/Storage configuration
  storage: {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    region: process.env.S3_REGION || "us-east-1",
    accessKey: process.env.S3_ACCESS_KEY || "aardvark_minio",
    secretKey: process.env.S3_SECRET_KEY || "aardvark_minio_secret",
    bucket: process.env.S3_BUCKET || "aardvark-uploads",
    cdnUrl: process.env.S3_CDN_URL,
  },

  // Email configuration
  mail: {
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "1025", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME || "Aardvark",
    fromEmail: process.env.SMTP_FROM_EMAIL || "noreply@aardvark.local",
  },

  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    premiumMonthlyPriceId: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    premiumYearlyPriceId: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
  },

  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000", 10),
  },

  // Rate limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },

  // Feature flags
  features: {
    nsfwContent: process.env.FEATURE_NSFW_CONTENT === "true",
    aiCompanion: process.env.FEATURE_AI_COMPANION !== "false",
    premiumSubscriptions: process.env.FEATURE_PREMIUM_SUBSCRIPTIONS !== "false",
    adRewards: process.env.FEATURE_AD_REWARDS !== "false",
    forum: process.env.FEATURE_FORUM !== "false",
    messaging: process.env.FEATURE_MESSAGING !== "false",
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
});
