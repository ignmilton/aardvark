import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import {
  User,
  Story,
  StorySegment,
  Choice,
  Tag,
  StoryStateVariable,
} from '../entities';

const SALT_ROUNDS = 12;

async function seed(ds: DataSource) {
  console.log('🌱 Starting database seed...');

  const userRepo = ds.getRepository(User);
  const storyRepo = ds.getRepository(Story);
  const segmentRepo = ds.getRepository(StorySegment);
  const choiceRepo = ds.getRepository(Choice);
  const tagRepo = ds.getRepository(Tag);
  const stateVarRepo = ds.getRepository(StoryStateVariable);

  // --- Users ---
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  const admin = userRepo.create({
    username: 'admin',
    email: 'admin@aardvark.dev',
    passwordHash,
    displayName: 'Platform Admin',
    role: 'admin',
    accountStatus: 'active',
    creditsBalance: 1000,
    isPremium: true,
    bio: 'Platform administrator.',
  });

  const moderator = userRepo.create({
    username: 'moderator',
    email: 'mod@aardvark.dev',
    passwordHash,
    displayName: 'Content Moderator',
    role: 'moderator',
    accountStatus: 'active',
    creditsBalance: 500,
    isPremium: false,
    bio: 'Community moderator keeping things safe.',
  });

  const author = userRepo.create({
    username: 'storywriter',
    email: 'author@aardvark.dev',
    passwordHash,
    displayName: 'Jane Storyteller',
    role: 'author',
    accountStatus: 'active',
    creditsBalance: 200,
    isPremium: true,
    bio: 'Interactive fiction enthusiast and author of branching narratives.',
  });

  const reader = userRepo.create({
    username: 'booklover',
    email: 'reader@aardvark.dev',
    passwordHash,
    displayName: 'Alex Reader',
    role: 'reader',
    accountStatus: 'active',
    creditsBalance: 50,
    isPremium: false,
    bio: 'Love reading interactive stories!',
  });

  const reader2 = userRepo.create({
    username: 'adventurer',
    email: 'reader2@aardvark.dev',
    passwordHash,
    displayName: 'Sam Explorer',
    role: 'reader',
    accountStatus: 'active',
    creditsBalance: 30,
    isPremium: false,
    bio: 'Always looking for the next adventure.',
  });

  const savedUsers = await userRepo.save([admin, moderator, author, reader, reader2]);
  const [savedAdmin, savedMod, savedAuthor, savedReader] = savedUsers;
  console.log(`  Created ${savedUsers.length} users`);

  // --- Tags ---
  console.log('Creating tags...');
  const tags = [
    { name: 'Fantasy', type: 'genre', description: 'Magic, mythical creatures, and otherworldly settings' },
    { name: 'Sci-Fi', type: 'genre', description: 'Futuristic technology, space exploration, and science' },
    { name: 'Mystery', type: 'genre', description: 'Puzzles, detective work, and suspense' },
    { name: 'Romance', type: 'genre', description: 'Love stories and relationships' },
    { name: 'Horror', type: 'genre', description: 'Fear, suspense, and the supernatural' },
    { name: 'Thriller', type: 'genre', description: 'Fast-paced tension and excitement' },
    { name: 'Adventure', type: 'theme', description: 'Exploration and quests' },
    { name: 'Coming of Age', type: 'theme', description: 'Growth and self-discovery' },
    { name: 'Dystopian', type: 'theme', description: 'Dark futures and societal collapse' },
    { name: 'Time Travel', type: 'theme', description: 'Journeys through time' },
  ];

  const savedTags = await tagRepo.save(
    tags.map((t) => tagRepo.create(t as any)),
  );
  console.log(`  Created ${savedTags.length} tags`);

  // --- Sample Story ---
  console.log('Creating sample story...');
  const story = storyRepo.create({
    title: 'The Enchanted Forest',
    slug: 'the-enchanted-forest',
    description: 'A branching adventure through a magical forest where every choice shapes your destiny. Will you befriend the ancient spirits or challenge the dark forces within?',
    authorId: savedAuthor.id,
    category: 'fantasy',
    collaborationMode: 'moderated',
    status: 'published',
    isPremium: false,
    creditCost: 0,
    nsfwFlag: false,
    language: 'en',
    tags: ['fantasy', 'adventure', 'magic'],
    contentWarnings: [],
    totalReads: 142,
    averageRating: 4.2,
    ratingCount: 18,
  });

  const savedStory = await storyRepo.save(story);

  // --- State Variables ---
  const stateVars = [
    stateVarRepo.create({
      storyId: savedStory.id,
      name: 'trust_spirit',
      type: 'number',
      defaultValue: '0',
      minValue: -10,
      maxValue: 10,
      displayToReader: true,
    }),
    stateVarRepo.create({
      storyId: savedStory.id,
      name: 'has_amulet',
      type: 'boolean',
      defaultValue: 'false',
      displayToReader: false,
    }),
  ];
  await stateVarRepo.save(stateVars);

  // --- Segments ---
  const rootSegment = segmentRepo.create({
    storyId: savedStory.id,
    authorId: savedAuthor.id,
    title: 'The Forest Edge',
    content: '<p>You stand at the edge of an ancient forest. The trees tower above you, their branches intertwining to form a canopy that filters the sunlight into dancing shadows on the forest floor.</p><p>A narrow path winds between the mossy trunks, disappearing into the dim green depths. From somewhere deep within, you hear the faint sound of running water and... something else. A melody, perhaps? Or just the wind through the leaves?</p><p>To your right, a weathered wooden signpost reads: <em>"The Enchanted Forest - Enter at your own risk. The spirits do not suffer fools."</em></p>',
    isRootSegment: true,
    isEnding: false,
    approvalStatus: 'approved',
    position: { x: 400, y: 100 },
    wordCount: 120,
    readCount: 142,
  });

  const segment2 = segmentRepo.create({
    storyId: savedStory.id,
    authorId: savedAuthor.id,
    title: 'The Winding Path',
    content: '<p>You step onto the path, feeling the soft moss cushion your footsteps. The air grows cooler as the canopy thickens overhead. Strange luminescent mushrooms dot the bases of the trees, casting a pale blue glow.</p><p>After walking for what feels like an hour, the path splits into two directions. To the left, the melody grows stronger - a hauntingly beautiful song that makes your heart ache. To the right, you notice small glowing footprints leading deeper into the shadows.</p>',
    isRootSegment: false,
    isEnding: false,
    approvalStatus: 'approved',
    position: { x: 400, y: 300 },
    parentSegmentIds: [],
    wordCount: 95,
    readCount: 128,
  });

  const segment3 = segmentRepo.create({
    storyId: savedStory.id,
    authorId: savedAuthor.id,
    title: 'The Spirit\'s Song',
    content: '<p>You follow the melody to a moonlit clearing where a translucent figure sits atop a mossy stone, singing softly. The spirit notices you and smiles warmly.</p><p>"A traveler! How delightful. It has been so long since someone chose my path." The spirit\'s voice is like wind chimes. "I am Lumara, guardian of this grove. Tell me, child of the outer world - do you come seeking wisdom, or adventure?"</p>',
    isRootSegment: false,
    isEnding: false,
    approvalStatus: 'approved',
    position: { x: 200, y: 500 },
    parentSegmentIds: [],
    wordCount: 88,
    readCount: 76,
    stateEffects: [{ variableName: 'trust_spirit', operation: 'add', value: '2' }],
  });

  const segment4 = segmentRepo.create({
    storyId: savedStory.id,
    authorId: savedAuthor.id,
    title: 'The Glowing Footprints',
    content: '<p>You follow the mysterious footprints deeper into the forest. The trees here are older, their bark covered in strange symbols that seem to shift when you look at them directly.</p><p>The footprints lead to a hollow tree, inside which you find a small golden amulet pulsing with warm light. As you pick it up, a voice echoes through the trees: "The amulet chooses its bearer wisely. But be warned - its power comes with responsibility."</p>',
    isRootSegment: false,
    isEnding: false,
    approvalStatus: 'approved',
    position: { x: 600, y: 500 },
    parentSegmentIds: [],
    wordCount: 98,
    readCount: 52,
    stateEffects: [{ variableName: 'has_amulet', operation: 'set', value: 'true' }],
  });

  const endingSegment = segmentRepo.create({
    storyId: savedStory.id,
    authorId: savedAuthor.id,
    title: 'Turn Back',
    content: '<p>You decide the forest is too dangerous and turn back. As you retreat to the safety of the open field, you feel a strange sense of loss - as if an opportunity has slipped through your fingers.</p><p>Perhaps another day, when you feel braver, you\'ll return to discover what secrets the Enchanted Forest holds.</p><p><strong>THE END</strong> - <em>You chose safety over adventure. Sometimes that\'s the wisest choice... but not always the most rewarding one.</em></p>',
    isRootSegment: false,
    isEnding: true,
    endingType: 'neutral',
    approvalStatus: 'approved',
    position: { x: 700, y: 300 },
    parentSegmentIds: [],
    wordCount: 85,
    readCount: 14,
  });

  const savedSegments = await segmentRepo.save([
    rootSegment, segment2, segment3, segment4, endingSegment,
  ]);

  // Update parentSegmentIds
  savedSegments[1].parentSegmentIds = [savedSegments[0].id];
  savedSegments[2].parentSegmentIds = [savedSegments[1].id];
  savedSegments[3].parentSegmentIds = [savedSegments[1].id];
  savedSegments[4].parentSegmentIds = [savedSegments[0].id];
  await segmentRepo.save(savedSegments.slice(1));

  console.log(`  Created ${savedSegments.length} segments`);

  // --- Choices ---
  const choices = [
    choiceRepo.create({
      segmentId: savedSegments[0].id,
      choiceText: 'Follow the path into the forest',
      nextSegmentId: savedSegments[1].id,
      order: 1,
    }),
    choiceRepo.create({
      segmentId: savedSegments[0].id,
      choiceText: 'Turn back - this place feels too dangerous',
      nextSegmentId: savedSegments[4].id,
      order: 2,
    }),
    choiceRepo.create({
      segmentId: savedSegments[1].id,
      choiceText: 'Follow the beautiful melody to the left',
      nextSegmentId: savedSegments[2].id,
      order: 1,
    }),
    choiceRepo.create({
      segmentId: savedSegments[1].id,
      choiceText: 'Investigate the glowing footprints to the right',
      nextSegmentId: savedSegments[3].id,
      order: 2,
    }),
  ];

  await choiceRepo.save(choices);
  console.log(`  Created ${choices.length} choices`);

  // --- Premium Story ---
  console.log('Creating premium story...');
  const premiumStory = storyRepo.create({
    title: 'Starship Odyssey',
    slug: 'starship-odyssey',
    description: 'Command a starship through the uncharted sectors of the galaxy. Every decision affects your crew, your mission, and the fate of humanity.',
    authorId: savedAuthor.id,
    category: 'sci_fi',
    collaborationMode: 'private',
    status: 'published',
    isPremium: true,
    creditCost: 15,
    nsfwFlag: false,
    language: 'en',
    tags: ['sci-fi', 'space', 'strategy'],
    contentWarnings: ['violence'],
    totalReads: 67,
    averageRating: 4.7,
    ratingCount: 9,
  });

  await storyRepo.save(premiumStory);
  console.log('  Created premium story');

  console.log('\n✅ Seed completed successfully!');
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
