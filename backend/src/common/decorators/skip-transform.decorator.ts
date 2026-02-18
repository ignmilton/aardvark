import { SetMetadata } from "@nestjs/common";

export const SKIP_TRANSFORM_KEY = "skipTransform";

/**
 * Decorator to skip the global TransformInterceptor response wrapping.
 * Use on controller methods that return non-JSON responses (file downloads,
 * streaming, etc.) that should not be wrapped in { success, data, timestamp }.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
