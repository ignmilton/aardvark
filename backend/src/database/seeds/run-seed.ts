import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import {
  User,
  Tag,
} from '../entities';
import {
  UserRole,
  AccountStatus,
  SubscriptionStatus,
} from '@aardvark/shared';

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
  console.log('🌱 Starting database seed...');
  console.log('📋 Creating system data only (no hardcoded stories per design spec)');

  const userRepo = ds.getRepository(User);
  const tagRepo = ds.getRepository(Tag);

  // --- Users ---
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  const admin = userRepo.create({
    username: 'admin',
    email: 'admin@aardvark.dev',
    passwordHash,
    displayName: 'Platform Admin',
    role: UserRole.ADMIN,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    creditsBalance: 1000,
    bio: 'Platform administrator.',
    emailVerified: true,
  });

  const moderator = userRepo.create({
    username: 'moderator',
    email: 'mod@aardvark.dev',
    passwordHash,
    displayName: 'Content Moderator',
    role: UserRole.MODERATOR,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.NONE,
    creditsBalance: 500,
    bio: 'Community moderator keeping things safe.',
    emailVerified: true,
  });

  const author = userRepo.create({
    username: 'storywriter',
    email: 'author@aardvark.dev',
    passwordHash,
    displayName: 'Jane Storyteller',
    role: UserRole.AUTHOR,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    creditsBalance: 200,
    bio: 'Interactive fiction enthusiast and author of branching narratives.',
    emailVerified: true,
  });

  const reader = userRepo.create({
    username: 'booklover',
    email: 'reader@aardvark.dev',
    passwordHash,
    displayName: 'Alex Reader',
    role: UserRole.READER,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.NONE,
    creditsBalance: 50,
    bio: 'Love reading interactive stories!',
    emailVerified: true,
  });

  const reader2 = userRepo.create({
    username: 'adventurer',
    email: 'reader2@aardvark.dev',
    passwordHash,
    displayName: 'Sam Explorer',
    role: UserRole.READER,
    accountStatus: AccountStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.NONE,
    creditsBalance: 30,
    bio: 'Always looking for the next adventure.',
    emailVerified: true,
  });

  const savedUsers = await userRepo.save([admin, moderator, author, reader, reader2]);
  console.log(`  Created ${savedUsers.length} users`);

  // --- Tags ---
  console.log('Creating tags...');
  const tagsData = [
    { name: 'Fantasy', slug: 'fantasy', type: 'genre', description: 'Magic, mythical creatures, and otherworldly settings' },
    { name: 'Sci-Fi', slug: 'sci-fi', type: 'genre', description: 'Futuristic technology, space exploration, and science' },
    { name: 'Mystery', slug: 'mystery', type: 'genre', description: 'Puzzles, detective work, and suspense' },
    { name: 'Romance', slug: 'romance', type: 'genre', description: 'Love stories and relationships' },
    { name: 'Horror', slug: 'horror', type: 'genre', description: 'Fear, suspense, and the supernatural' },
    { name: 'Thriller', slug: 'thriller', type: 'genre', description: 'Fast-paced tension and excitement' },
    { name: 'Adventure', slug: 'adventure', type: 'theme', description: 'Exploration and quests' },
    { name: 'Coming of Age', slug: 'coming-of-age', type: 'theme', description: 'Growth and self-discovery' },
    { name: 'Dystopian', slug: 'dystopian', type: 'theme', description: 'Dark futures and societal collapse' },
    { name: 'Time Travel', slug: 'time-travel', type: 'theme', description: 'Journeys through time' },
  ];

  const tagEntities = tagsData.map((t) => tagRepo.create(t as any));
  const savedTags = await tagRepo.save(tagEntities as any);
  console.log(`  Created ${savedTags.length} tags`);

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📝 Note: No sample stories created per design spec.');
  console.log('   Admins should create demo content via API after deployment.');
  console.log('\nTest accounts (password: Password123!):');
  console.log('  admin@aardvark.dev     (admin)');
  console.log('  mod@aardvark.dev       (moderator)');
  console.log('  author@aardvark.dev    (author, premium)');
  console.log('  reader@aardvark.dev    (reader)');
  console.log('  reader2@aardvark.dev   (reader)');
}

async function main() {
  try {
    await dataSource.initialize();
    console.log('Database connection established.');

    // Clear existing data (development only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Clearing existing data...');
      await dataSource.synchronize(true); // drops and recreates all tables
    }

    await seed(dataSource);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();
