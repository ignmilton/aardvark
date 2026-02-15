/**
 * Content filter for branch submissions.
 * Checks for malicious content, spam patterns, and minimum quality.
 * Returns a result indicating whether content passes or should be held for review.
 */

export interface ContentFilterResult {
  passed: boolean;
  reasons: string[];
}

// Patterns indicating potential script injection
const SCRIPT_PATTERNS = [
  /<script\b/i,
  /on\w+\s*=\s*["']/i, // event handlers like onclick="..."
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<form\b/i,
  /eval\s*\(/i,
  /document\s*\.\s*(cookie|write|location)/i,
  /window\s*\.\s*location/i,
];

// Minimum content length (characters, HTML stripped)
const MIN_CONTENT_LENGTH = 20;

// Maximum percentage of uppercase characters before flagging
const MAX_UPPERCASE_RATIO = 0.7;

// Minimum unique word ratio (prevents "aaa aaa aaa" spam)
const MIN_UNIQUE_WORD_RATIO = 0.2;

/**
 * Run content through the filter and return pass/fail with reasons.
 */
export function filterContent(htmlContent: string): ContentFilterResult {
  const reasons: string[] = [];

  // Strip HTML for text analysis
  const textContent = htmlContent.replace(/<[^>]*>/g, "").trim();

  // Check for script injection patterns in raw HTML
  for (const pattern of SCRIPT_PATTERNS) {
    if (pattern.test(htmlContent)) {
      reasons.push(
        "Content contains potentially malicious scripts or event handlers",
      );
      break;
    }
  }

  // Check minimum length
  if (textContent.length < MIN_CONTENT_LENGTH) {
    reasons.push(
      `Content too short (${textContent.length} characters, minimum ${MIN_CONTENT_LENGTH})`,
    );
  }

  // Check excessive uppercase (only for content with enough alpha chars)
  const alphaChars = textContent.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length > 20) {
    const uppercaseCount = alphaChars.replace(/[^A-Z]/g, "").length;
    const ratio = uppercaseCount / alphaChars.length;
    if (ratio > MAX_UPPERCASE_RATIO) {
      reasons.push("Content contains excessive uppercase characters");
    }
  }

  // Check for repetitive content (spam)
  const words = textContent.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 5) {
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < MIN_UNIQUE_WORD_RATIO) {
      reasons.push("Content appears to be repetitive or spam");
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
