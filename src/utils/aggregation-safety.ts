// Aggregation pipeline stages that are blocked when the server runs in
// read-only mode.
// - $out / $merge: write the pipeline output to a collection.
// - $function / $accumulator: execute arbitrary server-side JavaScript,
//   which can read other collections, run CPU-intensive code, and has
//   historically had sandbox-escape CVEs in older MongoDB versions.
// - $where inside `find`/`$match` is enforced separately at the filter level
//   via findServerSideJsOperator.
export const DANGEROUS_AGGREGATION_STAGES = [
  '$out',
  '$merge',
  '$function',
  '$accumulator',
] as const;

export function findDangerousStage(
  pipeline: ReadonlyArray<Record<string, unknown>>,
): string | undefined {
  for (const stage of pipeline) {
    for (const stageName of Object.keys(stage)) {
      if ((DANGEROUS_AGGREGATION_STAGES as readonly string[]).includes(stageName)) {
        return stageName;
      }
    }
  }

  return undefined;
}

// Recursively look for $where, $function, $accumulator inside a find filter
// (they can be nested in $and / $or / $nor / $expr).
const SERVER_SIDE_JS_OPERATORS = ['$where', '$function', '$accumulator'] as const;

export function findServerSideJsOperator(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findServerSideJsOperator(item);

      if (found) {
        return found;
      }
    }

    return undefined;
  }

  if (value === null || typeof value !== 'object') {
    return undefined;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((SERVER_SIDE_JS_OPERATORS as readonly string[]).includes(key)) {
      return key;
    }

    const found = findServerSideJsOperator(nested);

    if (found) {
      return found;
    }
  }

  return undefined;
}
