/** Public content only; never use for sessions, permissions, or editorial drafts. */
export const PUBLIC_CONTENT_TAG = "public-content-v1";

/** Cache at the origin; downstream caches cannot receive our publish invalidation. */
export const PUBLIC_CONTENT_CACHE_CONTROL = "public, no-cache, must-revalidate";
