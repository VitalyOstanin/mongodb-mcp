// Top-level pipeline stages that write data and are blocked in read-only mode.
const WRITE_PIPELINE_STAGES = ['$out', '$merge'] as const;

// Operators that execute arbitrary server-side JavaScript. They can read other
// collections, run CPU-intensive code, and have historically had sandbox-escape
// CVEs in older MongoDB versions. They are not stages on their own --
// $function and $accumulator are nested inside other stages ($addFields, $group),
// $where appears inside find filters or $match -- so we must search recursively.
const SERVER_SIDE_JS_OPERATORS = ['$where', '$function', '$accumulator'] as const;

// Returns the first dangerous element found in `pipeline`, either as a top-level
// write stage or as a nested server-side JS operator.
export function findDangerousStage(
  pipeline: ReadonlyArray<Record<string, unknown>>,
): string | undefined {
  for (const stage of pipeline) {
    for (const stageName of Object.keys(stage)) {
      if ((WRITE_PIPELINE_STAGES as readonly string[]).includes(stageName)) {
        return stageName;
      }
    }

    const nested = findServerSideJsOperator(stage);

    if (nested) {
      return nested;
    }
  }

  return undefined;
}

// Recursively look for $where / $function / $accumulator anywhere in the value.
// Used both by aggregate (nested in stages) and find (nested in filters).
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
