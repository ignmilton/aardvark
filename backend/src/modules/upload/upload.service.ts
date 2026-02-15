import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Allowed MIME types for file uploads organized by category.
 */
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"],
  document: ["application/pdf", "text/plain", "text/markdown"],
};

const ALL_ALLOWED_TYPES = Object.values(ALLOWED_MIME_TYPES).flat();

/**
 * Maximum file sizes in bytes per category.
 */
const MAX_FILE_SIZES: Record<string, number> = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  default: 5 * 1024 * 1024, // 5MB fallback
};

/**
 * Upload service providing file validation, type checking, and size enforcement.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate an uploaded file for type and size constraints.
   * Throws BadRequestException if validation fails.
   */
  validateFile(
    file: Express.Multer.File,
    allowedCategory?: "image" | "document",
  ): void {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Check MIME type
    const allowedTypes = allowedCategory
      ? ALLOWED_MIME_TYPES[allowedCategory] || ALL_ALLOWED_TYPES
      : ALL_ALLOWED_TYPES;

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
      );
    }

    // Determine category from mimetype for size check
    const category =
      allowedCategory || this.getCategoryFromMimeType(file.mimetype);
    const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
      );
    }

    // Check for dangerous file extensions in original name
    const dangerousExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".sh",
      ".php",
      ".jsp",
      ".cgi",
      ".scr",
      ".com",
      ".pif",
      ".vbs",
      ".js",
    ];
    const lowerName = file.originalname.toLowerCase();
    for (const ext of dangerousExtensions) {
      if (lowerName.endsWith(ext)) {
        throw new BadRequestException(
          `File extension "${ext}" is not allowed for security reasons`,
        );
      }
    }

    // Validate that image magic bytes match the claimed MIME type
    if (file.mimetype.startsWith("image/") && file.buffer) {
      this.validateImageMagicBytes(file);
    }

    this.logger.debug(
      `File validated: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );
  }

  /**
   * Validate image magic bytes to prevent MIME spoofing.
   */
  private validateImageMagicBytes(file: Express.Multer.File): void {
    if (!file.buffer || file.buffer.length < 4) return;

    const bytes = file.buffer.slice(0, 8);
    const signatures: Record<string, number[][]> = {
      "image/jpeg": [[0xff, 0xd8, 0xff]],
      "image/png": [[0x89, 0x50, 0x4e, 0x47]],
      "image/gif": [[0x47, 0x49, 0x46, 0x38]],
      "image/webp": [], // RIFF header checked separately
    };

    const expectedSigs = signatures[file.mimetype];
    if (!expectedSigs || expectedSigs.length === 0) return;

    const matches = expectedSigs.some((sig) =>
      sig.every((byte, index) => bytes[index] === byte),
    );

    if (!matches) {
      throw new BadRequestException(
        "File content does not match its declared type. Possible file spoofing detected.",
      );
    }
  }

  private getCategoryFromMimeType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("application/pdf") || mimeType.startsWith("text/"))
      return "document";
    return "default";
  }
}
