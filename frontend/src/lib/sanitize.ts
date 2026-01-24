import DOMPurify from 'isomorphic-dompurify';

/**
 * Allowed HTML tags for story content rendering.
 * Prevents XSS while allowing rich text formatting.
 */
const ALLOWED_TAGS = [
  // Text formatting
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'mark', 'sub', 'sup', 'small',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li',
  // Block elements
  'blockquote', 'pre', 'code', 'hr', 'div', 'span',
  // Links (href only, no javascript:)
  'a',
  // Images (src only, no onerror)
  'img',
  // Tables
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // Media
  'figure', 'figcaption',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'title', 'alt', 'src', 'width', 'height',
  'class', 'id', 'colspan', 'rowspan', 'start', 'type',
];

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows standard rich text formatting while stripping dangerous elements.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

// Configure DOMPurify hooks for link safety
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Force external links to open in new tab
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');

      // Remove javascript: URLs
      const href = node.getAttribute('href') || '';
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        node.removeAttribute('href');
      }
    }

    // Remove event handlers from all elements
    const attrs = node.attributes;
    if (attrs) {
      for (let i = attrs.length - 1; i >= 0; i--) {
        if (attrs[i].name.startsWith('on')) {
          node.removeAttribute(attrs[i].name);
        }
      }
    }
  });
}
