/** A delta source inventory is not a denominator for the entire target archive. */
export function migrationCoverage({ since, sourceCount, targetPublished }) {
  return {
    wordpressPublished: since ? null : sourceCount,
    incrementalSourceCount: since ? sourceCount : null,
    coveragePercent: !since && sourceCount > 0 ? Math.round(targetPublished / sourceCount * 10000) / 100 : null,
  };
}
