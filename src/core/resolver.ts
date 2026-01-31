import semver from 'semver';
import { git } from './git.js';
import { parseSource, sourceToRepoUrl } from './parse.js';

export type ResolvedRef = {
  url: string;
  // the requested ref/range from manifest or context.yaml depends
  requested: string | null;
  // best-effort resolved semver version (if tag-based)
  version: string | null;
  // git commit SHA
  commit: string;
  // git ref used for checkout (tag name, branch, or commit)
  checkout: string;
};

function looksLikeCommit(ref: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(ref);
}

export async function listRemoteTags(repo: string): Promise<Map<string, string>> {
  // Returns tagName -> commit sha (annotated tags resolved)
  const repoUrl = sourceToRepoUrl(repo);
  const { stdout } = await git(process.cwd(), ['ls-remote', '--tags', repoUrl]);
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);

  const direct = new Map<string, string>();
  const deref = new Map<string, string>();

  for (const line of lines) {
    const [sha, ref] = line.split(/\s+/);
    if (!sha || !ref) continue;
    const m = ref.match(/^refs\/tags\/(.+)$/);
    if (!m) continue;
    const tag = m[1];
    if (tag.endsWith('^{}')) deref.set(tag.replace(/\^\{\}$/, ''), sha);
    else direct.set(tag, sha);
  }

  // Prefer deref when present
  const out = new Map<string, string>();
  for (const [tag, sha] of direct.entries()) out.set(tag, sha);
  for (const [tag, sha] of deref.entries()) out.set(tag, sha);
  return out;
}

export async function resolveRef(url: string, requested: string | null): Promise<ResolvedRef> {
  const repoUrl = sourceToRepoUrl(url);
  const spec = (requested ?? '').trim();

  // Empty -> latest tag if possible, else main
  if (!spec) {
    const tags = await listRemoteTags(url);
    const versions = [...tags.keys()]
      .map((t) => t.replace(/^v/, ''))
      .filter((v) => semver.valid(v));
    const latest = semver.maxSatisfying(versions, '*');
    if (latest) {
      const tagName = [...tags.keys()].find((t) => t === `v${latest}`) ?? latest;
      const commit = tags.get(tagName) ?? '';
      return { url, requested: null, version: latest, commit, checkout: tagName };
    }

    const { stdout } = await git(process.cwd(), ['ls-remote', '--heads', repoUrl, 'main']);
    const sha = stdout.split(/\s+/)[0]?.trim();
    if (!sha) throw new Error(`Unable to resolve default ref for ${url}`);
    return { url, requested: null, version: null, commit: sha, checkout: 'main' };
  }

  // Commit SHA
  if (looksLikeCommit(spec)) {
    return { url, requested: spec, version: null, commit: spec, checkout: spec };
  }

  // latest
  if (spec === 'latest') {
    const tags = await listRemoteTags(url);
    const versions = [...tags.keys()]
      .map((t) => t.replace(/^v/, ''))
      .filter((v) => semver.valid(v));
    const latest = semver.maxSatisfying(versions, '*');
    if (!latest) throw new Error(`No semver tags found for ${url}`);
    const tagName = [...tags.keys()].find((t) => t === `v${latest}`) ?? `v${latest}`;
    const commit = tags.get(tagName);
    if (!commit) throw new Error(`Could not find commit for tag ${tagName} in ${url}`);
    return { url, requested: spec, version: latest, commit, checkout: tagName };
  }

  // Semver range
  if (semver.validRange(spec)) {
    const tags = await listRemoteTags(url);
    const versions = [...tags.keys()]
      .map((t) => t.replace(/^v/, ''))
      .filter((v) => semver.valid(v));
    const match = semver.maxSatisfying(versions, spec);
    if (!match) {
      throw new Error(`No version satisfies ${url}@${spec}. Available tags: ${versions.sort(semver.rcompare).join(', ')}`);
    }
    const tagName = [...tags.keys()].find((t) => t === `v${match}`) ?? `v${match}`;
    const commit = tags.get(tagName);
    if (!commit) throw new Error(`Could not find commit for tag ${tagName} in ${url}`);
    return { url, requested: spec, version: match, commit, checkout: tagName };
  }

  // Exact tag name (e.g. v1.2.3)
  if (spec.startsWith('v') && semver.valid(spec.slice(1))) {
    const tags = await listRemoteTags(url);
    const commit = tags.get(spec);
    if (!commit) throw new Error(`Tag not found: ${url}@${spec}`);
    return { url, requested: spec, version: spec.slice(1), commit, checkout: spec };
  }

  // Branch name
  const { stdout } = await git(process.cwd(), ['ls-remote', '--heads', repoUrl, spec]);
  const sha = stdout.split(/\s+/)[0]?.trim();
  if (!sha) throw new Error(`Branch not found (or not accessible): ${url}@${spec}`);
  return { url, requested: spec, version: null, commit: sha, checkout: spec };
}

export function normalizeDepends(dep: string): { url: string; ref: string | null } {
  const { url, ref } = parseSource(dep);
  return { url, ref: ref ?? null };
}

export async function resolveWithConstraints(
  url: string,
  requestedSpecs: Array<string | null>,
  override: string | null
): Promise<ResolvedRef> {
  const specs = override ? [override] : requestedSpecs.filter((s): s is string => Boolean(s && String(s).trim()));
  if (specs.length === 0) return resolveRef(url, null);

  // If any spec is a commit or non-semver branch/tag, we require all specs to be identical.
  const nonSemver = specs.filter((s) => !semver.validRange(s) && s !== 'latest');
  if (nonSemver.length > 0) {
    const first = nonSemver[0];
    const mismatch = specs.find((s) => s !== first);
    if (mismatch) {
      throw new Error(
        `Conflicting ref requirements for ${url}: ${specs.join(', ')}. ` +
          `Use manifest overrides to force a single ref.`
      );
    }
    return resolveRef(url, first);
  }

  // All specs are semver ranges or 'latest'
  const tags = await listRemoteTags(url);
  const versions = [...tags.keys()]
    .map((t) => t.replace(/^v/, ''))
    .filter((v) => semver.valid(v));

  const ranges = specs.filter((s) => s !== 'latest');
  const candidates = versions.filter((v) => ranges.every((r) => semver.satisfies(v, r)));
  const best = semver.maxSatisfying(candidates, '*');
  if (!best) {
    throw new Error(`No version satisfies all constraints for ${url}: ${specs.join(', ')}`);
  }
  const tagName = [...tags.keys()].find((t) => t === `v${best}`) ?? `v${best}`;
  const commit = tags.get(tagName);
  if (!commit) throw new Error(`Could not find commit for tag ${tagName} in ${url}`);

  // requested: keep override or join ranges
  const requested = override ? override : ranges.join(' & ');
  return { url, requested, version: best, commit, checkout: tagName };
}
