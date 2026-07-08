export type SearchOptions = {
  query: string;
  replaceWith: string;
  matchCase: boolean;
  regex: boolean;
  wholeWord: boolean;
};

export type SearchMatch = {
  from: number;
  to: number;
  text: string;
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildSearchRegExp(options: SearchOptions, global = true): RegExp | null {
  if (!options.query) {
    return null;
  }

  const source = options.regex ? options.query : escapeRegExp(options.query);
  const guardedSource = options.wholeWord ? `\\b(?:${source})\\b` : source;
  const flags = `${global ? "g" : ""}${options.matchCase ? "" : "i"}`;

  return new RegExp(guardedSource, flags);
}

export function findMatches(content: string, options: SearchOptions): SearchMatch[] {
  const expression = buildSearchRegExp(options);

  if (!expression) {
    return [];
  }

  const matches: SearchMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = expression.exec(content)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      text: match[0]
    });

    if (match[0].length === 0) {
      expression.lastIndex += 1;
    }
  }

  return matches;
}

export function replaceAll(content: string, options: SearchOptions): string {
  const expression = buildSearchRegExp(options);
  return expression ? content.replace(expression, options.replaceWith) : content;
}

export function replaceOne(text: string, options: SearchOptions): string {
  const expression = buildSearchRegExp(options, false);
  return expression ? text.replace(expression, options.replaceWith) : text;
}
