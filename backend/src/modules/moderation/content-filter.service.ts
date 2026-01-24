import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ContentFlag,
  ModerationContentType,
  ModerationStatus,
} from '@/database/entities/moderation.entity';

/**
 * Content filter types for automated moderation
 */
export enum ContentFilterType {
  PROFANITY = 'profanity',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  SPAM = 'spam',
  ADULT_CONTENT = 'adult_content',
  HARASSMENT = 'harassment',
  SELF_HARM = 'self_harm',
}

/**
 * Content filter result
 */
export interface ContentFilterResult {
  isClean: boolean;
  flags: {
    type: ContentFilterType;
    confidence: number;
    matchedPatterns?: string[];
  }[];
  overallConfidence: number;
}

/**
 * Profanity word lists by severity
 */
const PROFANITY_PATTERNS = {
  severe: [
    // Severe profanity patterns (redacted for safety, would include actual patterns in production)
    /\bf+u+c+k+/gi,
    /\bs+h+i+t+/gi,
    /\bc+u+n+t+/gi,
    /\bn+[i1]+g+[g3]+[a@e]+r*/gi,
  ],
  moderate: [
    /\bd+a+m+n+/gi,
    /\bh+e+l+l+/gi,
    /\ba+s+s+(?:hole)?/gi,
    /\bb+i+t+c+h+/gi,
    /\bb+a+s+t+a+r+d+/gi,
  ],
  mild: [
    /\bcrap+/gi,
    /\bsuck+s?/gi,
    /\bpiss+/gi,
  ],
};

/**
 * Hate speech patterns
 */
const HATE_SPEECH_PATTERNS = [
  // Racial slurs and hate terms (patterns only, actual words redacted)
  /\b(kill|murder|exterminate)\s+(all\s+)?(jews|muslims|blacks|whites|gays)/gi,
  /\bdeath\s+to\s+/gi,
  /\b(inferior|subhuman)\s+(race|people)/gi,
];

/**
 * Spam patterns
 */
const SPAM_PATTERNS = [
  /\b(buy|click|free|winner|congratulations|lottery)\b.*\b(now|here|link)/gi,
  /(https?:\/\/[^\s]+){3,}/gi, // Multiple URLs
  /(.)\1{10,}/gi, // Repeated characters
  /\b(viagra|cialis|crypto|bitcoin|invest)\b.*\b(click|link|buy|offer)/gi,
];

/**
 * Violence patterns
 */
const VIOLENCE_PATTERNS = [
  /\b(kill|murder|stab|shoot|torture)\s+(you|them|him|her|everyone)/gi,
  /\b(i('ll|'m going to)|gonna)\s+(kill|murder|hurt|beat)/gi,
  /\b(bomb|explode|massacre|bloodbath)\b/gi,
];

/**
 * Self-harm patterns
 */
const SELF_HARM_PATTERNS = [
  /\b(kill|hurt|cut|harm)\s+(myself|yourself)/gi,
  /\b(suicide|suicidal|end\s+it\s+all)/gi,
  /\bwant\s+to\s+die\b/gi,
];

/**
 * Automated Content Moderation Service
 * Provides ML-like content filtering using pattern matching and heuristics
 * Can be extended to integrate with AWS Comprehend, OpenAI Moderation API, etc.
 */
@Injectable()
export class ContentFilterService {
  private readonly logger = new Logger(ContentFilterService.name);
  private readonly autoFlagThreshold: number;
  private readonly profanityLevel: 'strict' | 'moderate' | 'relaxed';

  constructor(
    @InjectRepository(ContentFlag)
    private readonly contentFlagRepository: Repository<ContentFlag>,
    private readonly configService: ConfigService,
  ) {
    this.autoFlagThreshold = this.configService.get<number>('CONTENT_FILTER_THRESHOLD', 0.7);
    this.profanityLevel = this.configService.get('PROFANITY_FILTER_LEVEL', 'moderate');
  }

  /**
   * Analyze content for violations
   */
  async analyzeContent(
    content: string,
    contentType: ModerationContentType,
    contentId: string,
    authorId?: string,
  ): Promise<ContentFilterResult> {
    const flags: ContentFilterResult['flags'] = [];

    // Check profanity
    const profanityResult = this.checkProfanity(content);
    if (profanityResult.confidence > 0) {
      flags.push({
        type: ContentFilterType.PROFANITY,
        confidence: profanityResult.confidence,
        matchedPatterns: profanityResult.matches,
      });
    }

    // Check hate speech
    const hateSpeechResult = this.checkPatterns(content, HATE_SPEECH_PATTERNS, 'hate speech');
    if (hateSpeechResult.confidence > 0) {
      flags.push({
        type: ContentFilterType.HATE_SPEECH,
        confidence: hateSpeechResult.confidence,
        matchedPatterns: hateSpeechResult.matches,
      });
    }

    // Check spam
    const spamResult = this.checkPatterns(content, SPAM_PATTERNS, 'spam');
    if (spamResult.confidence > 0) {
      flags.push({
        type: ContentFilterType.SPAM,
        confidence: spamResult.confidence,
        matchedPatterns: spamResult.matches,
      });
    }

    // Check violence
    const violenceResult = this.checkPatterns(content, VIOLENCE_PATTERNS, 'violence');
    if (violenceResult.confidence > 0) {
      flags.push({
        type: ContentFilterType.VIOLENCE,
        confidence: violenceResult.confidence,
        matchedPatterns: violenceResult.matches,
      });
    }

    // Check self-harm content
    const selfHarmResult = this.checkPatterns(content, SELF_HARM_PATTERNS, 'self-harm');
    if (selfHarmResult.confidence > 0) {
      flags.push({
        type: ContentFilterType.SELF_HARM,
        confidence: selfHarmResult.confidence,
        matchedPatterns: selfHarmResult.matches,
      });
    }

    // Calculate overall confidence
    const overallConfidence = flags.length > 0
      ? Math.max(...flags.map(f => f.confidence))
      : 0;

    const result: ContentFilterResult = {
      isClean: overallConfidence < this.autoFlagThreshold,
      flags,
      overallConfidence,
    };

    // Auto-flag content if threshold exceeded
    if (!result.isClean && authorId) {
      await this.createContentFlags(contentType, contentId, authorId, flags);
    }

    return result;
  }

  /**
   * Check content for profanity based on configured level
   */
  private checkProfanity(content: string): { confidence: number; matches: string[] } {
    const matches: string[] = [];
    let severityScore = 0;

    // Check severe profanity (always checked)
    for (const pattern of PROFANITY_PATTERNS.severe) {
      const found = content.match(pattern);
      if (found) {
        matches.push(...found);
        severityScore += 1.0;
      }
    }

    // Check moderate profanity
    if (this.profanityLevel === 'strict' || this.profanityLevel === 'moderate') {
      for (const pattern of PROFANITY_PATTERNS.moderate) {
        const found = content.match(pattern);
        if (found) {
          matches.push(...found);
          severityScore += 0.5;
        }
      }
    }

    // Check mild profanity (only in strict mode)
    if (this.profanityLevel === 'strict') {
      for (const pattern of PROFANITY_PATTERNS.mild) {
        const found = content.match(pattern);
        if (found) {
          matches.push(...found);
          severityScore += 0.2;
        }
      }
    }

    // Normalize confidence to 0-1 range
    const confidence = Math.min(severityScore / 2, 1.0);

    return {
      confidence,
      matches: [...new Set(matches)], // Remove duplicates
    };
  }

  /**
   * Check content against a set of patterns
   */
  private checkPatterns(
    content: string,
    patterns: RegExp[],
    type: string,
  ): { confidence: number; matches: string[] } {
    const matches: string[] = [];
    let matchCount = 0;

    for (const pattern of patterns) {
      const found = content.match(pattern);
      if (found) {
        matches.push(...found);
        matchCount++;
      }
    }

    // Calculate confidence based on number of pattern matches
    const confidence = matchCount > 0
      ? Math.min(matchCount / patterns.length + 0.5, 1.0)
      : 0;

    return {
      confidence,
      matches: [...new Set(matches)],
    };
  }

  /**
   * Create content flags for detected violations
   */
  private async createContentFlags(
    contentType: ModerationContentType,
    contentId: string,
    authorId: string,
    flags: ContentFilterResult['flags'],
  ): Promise<void> {
    for (const flag of flags) {
      try {
        // Check if flag already exists
        const existing = await this.contentFlagRepository.findOne({
          where: {
            contentType,
            contentId,
            flagType: flag.type,
          },
        });

        if (!existing) {
          const contentFlag = this.contentFlagRepository.create({
            contentType,
            contentId,
            authorId,
            flagType: flag.type,
            confidence: flag.confidence,
            matchedPatterns: flag.matchedPatterns?.join(', ') || null,
            status: ModerationStatus.PENDING,
            isAutoResolved: false,
          });

          await this.contentFlagRepository.save(contentFlag);
          this.logger.log(
            `Auto-flagged ${contentType} ${contentId} for ${flag.type} (confidence: ${flag.confidence})`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to create content flag: ${error.message}`);
      }
    }
  }

  /**
   * Filter/sanitize content by replacing profanity with asterisks
   */
  sanitizeContent(content: string): string {
    let sanitized = content;

    // Replace severe profanity
    for (const pattern of PROFANITY_PATTERNS.severe) {
      sanitized = sanitized.replace(pattern, (match) => '*'.repeat(match.length));
    }

    // Replace moderate profanity if configured
    if (this.profanityLevel === 'strict' || this.profanityLevel === 'moderate') {
      for (const pattern of PROFANITY_PATTERNS.moderate) {
        sanitized = sanitized.replace(pattern, (match) => '*'.repeat(match.length));
      }
    }

    return sanitized;
  }

  /**
   * Check if content is safe for the given rating
   */
  async isContentSafeForRating(
    content: string,
    rating: 'G' | 'PG' | 'PG13' | 'R' | 'MATURE',
  ): Promise<{ safe: boolean; violations: string[] }> {
    const result = await this.analyzeContent(
      content,
      ModerationContentType.STORY,
      'rating-check',
    );

    const violations: string[] = [];

    for (const flag of result.flags) {
      switch (rating) {
        case 'G':
          // No flags allowed for G rating
          if (flag.confidence > 0.3) {
            violations.push(`${flag.type} content detected`);
          }
          break;
        case 'PG':
          // Only mild content allowed
          if (flag.type !== ContentFilterType.PROFANITY && flag.confidence > 0.5) {
            violations.push(`${flag.type} content detected`);
          }
          break;
        case 'PG13':
          // Moderate content allowed, no hate speech/violence
          if (
            (flag.type === ContentFilterType.HATE_SPEECH ||
              flag.type === ContentFilterType.VIOLENCE ||
              flag.type === ContentFilterType.SELF_HARM) &&
            flag.confidence > 0.7
          ) {
            violations.push(`${flag.type} content detected`);
          }
          break;
        case 'R':
        case 'MATURE':
          // Only hate speech and self-harm flagged
          if (
            (flag.type === ContentFilterType.HATE_SPEECH ||
              flag.type === ContentFilterType.SELF_HARM) &&
            flag.confidence > 0.8
          ) {
            violations.push(`${flag.type} content detected`);
          }
          break;
      }
    }

    return {
      safe: violations.length === 0,
      violations,
    };
  }

  /**
   * Analyze image for inappropriate content.
   * Performs URL validation, checks content type, and optionally calls
   * an external moderation API (configured via IMAGE_MODERATION_API_URL).
   */
  async analyzeImage(
    imageUrl: string,
    contentType: ModerationContentType,
    contentId: string,
    authorId?: string,
  ): Promise<{ safe: boolean; flags: string[] }> {
    const flags: string[] = [];

    // Block data: URIs (potential XSS/exploit vector)
    if (/^data:/i.test(imageUrl)) {
      flags.push('data_uri_blocked');
      await this.flagContent(contentType, contentId, authorId, 'data_uri', 1.0, imageUrl);
      return { safe: false, flags };
    }

    // Block non-http(s) URLs
    if (!/^https?:\/\//i.test(imageUrl)) {
      flags.push('invalid_protocol');
      return { safe: false, flags };
    }

    // Check for suspicious URL patterns (common exploit hosting)
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|sh|ps1|msi)(\?|$)/i,
      /javascript:/i,
      /\.php\?/i,
    ];
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(imageUrl)) {
        flags.push('suspicious_url_pattern');
        await this.flagContent(contentType, contentId, authorId, 'suspicious_url', 0.9, imageUrl);
        return { safe: false, flags };
      }
    }

    // Validate that the URL actually points to an image via HEAD request
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(imageUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      const responseContentType = response.headers.get('content-type') || '';
      if (!responseContentType.startsWith('image/')) {
        flags.push('not_an_image');
        await this.flagContent(contentType, contentId, authorId, 'invalid_content_type', 0.95, `${imageUrl} -> ${responseContentType}`);
        return { safe: false, flags };
      }
    } catch (error) {
      // If URL is unreachable, flag but don't block (might be temporary)
      this.logger.warn(`Image URL unreachable: ${imageUrl} - ${error.message}`);
      flags.push('unreachable_url');
    }

    // Call external moderation API if configured
    const moderationApiUrl = this.configService.get<string>('IMAGE_MODERATION_API_URL');
    if (moderationApiUrl) {
      try {
        const apiKey = this.configService.get<string>('IMAGE_MODERATION_API_KEY');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(moderationApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ image_url: imageUrl }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const result = await response.json();
          // Expected response: { safe: boolean, categories: string[] }
          if (result.safe === false) {
            const categories = result.categories || ['nsfw_content'];
            flags.push(...categories);
            await this.flagContent(
              contentType,
              contentId,
              authorId,
              categories.join(','),
              result.confidence || 0.8,
              imageUrl,
            );
            return { safe: false, flags };
          }
        }
      } catch (error) {
        this.logger.warn(`External image moderation failed: ${error.message}`);
        // Don't block on moderation service failure - flag for manual review
        await this.flagContent(contentType, contentId, authorId, 'moderation_api_error', 0.5, imageUrl);
      }
    }

    return { safe: flags.length === 0, flags };
  }

  /**
   * Helper to create a content flag record
   */
  private async flagContent(
    contentType: ModerationContentType,
    contentId: string,
    authorId: string | undefined,
    flagType: string,
    confidence: number,
    patterns: string,
  ): Promise<void> {
    const flag = this.contentFlagRepository.create({
      contentType,
      contentId,
      authorId: authorId || null,
      flagType,
      confidence,
      matchedPatterns: patterns,
      status: ModerationStatus.PENDING,
      isAutoResolved: false,
    });
    await this.contentFlagRepository.save(flag);
  }
}
