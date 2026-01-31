// Parse a source string like:
//   github.com/org/repo@^1.0
//   github.com/org/monorepo/path/to/context@v1.2.3
// This MVP supports only "host/path" + optional @ref.

export type ParsedSource = {
  url: string;     // e.g. github.com/org/repo
  ref?: string;    // e.g. ^1.0, v1.2.3, main
};

export function parseSource(input: string): ParsedSource {
  const at = input.lastIndexOf('@');
  if (at > 0) {
    return { url: input.slice(0, at), ref: input.slice(at + 1) };
  }
  return { url: input };
}

export function sourceToRepoUrl(url: string): string {
  // assume https for standard host/path sources
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('git@') ||
    url.startsWith('file://')
  ) {
    return url;
  }

  // Local path support (useful for tests / local dev)
  if (url.startsWith('.') || url.startsWith('/') || url.includes('\\')) return url;

  return `https://${url}.git`;
}

export function sourceToInstallPath(url: string): string {
  // `.context/packages/<url>`
  // Keep it filesystem-safe.
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^file:\/\//, 'file/')
    .replace(/\.git$/, '')
    .replace(/[:]/g, '_');
}
