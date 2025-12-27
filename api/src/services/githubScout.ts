/**
 * GitHub Scout Service
 *
 * Fetches repository context via GitHub API without cloning.
 * This eliminates security risks from prompt injection in cloned files
 * and reduces bandwidth/disk usage.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'Crunch-FYI-Scout/1.0',
  ...(GITHUB_TOKEN && { 'Authorization': `Bearer ${GITHUB_TOKEN}` })
};

async function fetchGitHub(endpoint: string): Promise<any> {
  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  return response.json();
}

// Types
export interface RepoMetadata {
  owner: string;
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  license: string | null;
  created: string;
  last_updated: string;
}

export interface CodeSample {
  path: string;
  lines: number;
  exports: Array<{ type: string; name: string }>;
  imports: string[];
  content: string;
}

export interface RepoDigest {
  repo: RepoMetadata;
  readme: string | null;
  structure: {
    total_files: number;
    project_type: string;
    main_directories: string[];
    all_top_level: string[];
    key_files: string[];
  };
  code_samples: CodeSample[];
  summary: {
    file_count: number;
    has_tests: boolean;
    has_ci: boolean;
    has_docs: boolean;
    has_docker: boolean;
  };
}

// Parse GitHub URL to extract owner and repo
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various formats:
  // - github.com/owner/repo
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo/...
  // - owner/repo

  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\s]+)/,
    /^([^\/\s]+)\/([^\/\s]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '')
      };
    }
  }

  return null;
}

async function getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
  const data = await fetchGitHub(`/repos/${owner}/${repo}`);
  return {
    owner,
    name: data.name,
    url: `https://github.com/${owner}/${repo}`,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    topics: data.topics || [],
    license: data.license?.name || null,
    created: data.created_at,
    last_updated: data.updated_at
  };
}

async function getReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const data = await fetchGitHub(`/repos/${owner}/${repo}/readme`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    // Truncate if too long
    return content.length > 4000 ? content.slice(0, 4000) + '\n\n[... truncated ...]' : content;
  } catch {
    return null;
  }
}

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

async function getTree(owner: string, repo: string): Promise<{
  all_files: string[];
  top_level_dirs: string[];
  total_files: number;
}> {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);

  const files = data.tree
    .filter((item: TreeItem) => item.type === 'blob')
    .map((item: TreeItem) => item.path);

  const dirs = [...new Set(
    data.tree
      .filter((item: TreeItem) => item.type === 'tree')
      .map((item: TreeItem) => item.path)
  )] as string[];

  return {
    all_files: files,
    top_level_dirs: dirs.filter((d: string) => !d.includes('/')),
    total_files: files.length
  };
}

async function getFile(owner: string, repo: string, path: string): Promise<CodeSample | null> {
  try {
    const data = await fetchGitHub(`/repos/${owner}/${repo}/contents/${path}`);
    if (data.type !== 'file') return null;

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const lines = content.split('\n').length;

    return {
      path: data.path,
      lines,
      exports: extractExports(content, path),
      imports: extractImports(content, path),
      content: content.length > 2000 ? content.slice(0, 2000) + '\n// ... truncated ...' : content
    };
  } catch {
    return null;
  }
}

function extractExports(content: string, path: string): Array<{ type: string; name: string }> {
  const exports: Array<{ type: string; name: string }> = [];

  if (/\.(ts|js|tsx|jsx)$/.test(path)) {
    // ES6 exports
    const namedExportRegex = /export\s+(const|let|var|function|class|type|interface)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push({ type: match[1], name: match[2] });
    }

    if (/export\s+default/.test(content)) {
      exports.push({ type: 'default', name: 'default' });
    }

    // CommonJS
    if (/module\.exports\s*=/.test(content)) {
      exports.push({ type: 'commonjs', name: 'module.exports' });
    }

    const cjsExportRegex = /exports\.(\w+)\s*=/g;
    while ((match = cjsExportRegex.exec(content)) !== null) {
      exports.push({ type: 'commonjs', name: match[1] });
    }
  } else if (/\.py$/.test(path)) {
    // Python classes and functions
    const classRegex = /^class\s+(\w+)/gm;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      exports.push({ type: 'class', name: match[1] });
    }

    const funcRegex = /^def\s+(\w+)/gm;
    while ((match = funcRegex.exec(content)) !== null) {
      exports.push({ type: 'function', name: match[1] });
    }
  }

  return exports;
}

function extractImports(content: string, path: string): string[] {
  const imports: string[] = [];

  if (/\.(ts|js|tsx|jsx)$/.test(path)) {
    // ES6 imports
    const importRegex = /import\s+(?:(\w+)|{([^}]+)}|\*\s+as\s+(\w+))?\s*(?:,\s*{([^}]+)})?\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[5]);
    }

    // CommonJS requires
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  } else if (/\.py$/.test(path)) {
    const importRegex = /^import\s+([\w.]+)/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    const fromRegex = /^from\s+([\w.]+)\s+import/gm;
    while ((match = fromRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)];
}

function detectProjectType(files: string[]): string {
  const fileSet = new Set(files.map(f => f.split('/').pop() || ''));

  if (fileSet.has('package.json')) {
    if (files.some(f => f.includes('next.config'))) return 'Next.js';
    if (files.some(f => f.includes('vite.config'))) return 'Vite';
    if (files.some(f => f.includes('angular.json'))) return 'Angular';
    if (files.some(f => f.includes('.vue'))) return 'Vue';
    return 'Node.js';
  }
  if (fileSet.has('Cargo.toml')) return 'Rust';
  if (fileSet.has('go.mod')) return 'Go';
  if (fileSet.has('pyproject.toml') || fileSet.has('requirements.txt')) return 'Python';
  if (fileSet.has('Gemfile')) return 'Ruby';
  if (fileSet.has('composer.json')) return 'PHP';

  return 'Unknown';
}

/**
 * Get a comprehensive digest of a repository via GitHub API.
 * This is the main entry point for article generation.
 */
export async function getRepoDigest(repoUrl: string): Promise<RepoDigest> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  const { owner, repo } = parsed;

  // Fetch everything in parallel
  const [metadata, readme, tree] = await Promise.all([
    getRepoMetadata(owner, repo),
    getReadme(owner, repo),
    getTree(owner, repo)
  ]);

  const projectType = detectProjectType(tree.all_files);

  // Identify interesting directories
  const srcDirs = tree.top_level_dirs.filter(d =>
    /^(src|lib|app|pkg|cmd|internal|packages|modules|core)$/i.test(d)
  );

  // Find key architectural files
  const architecturalFiles = tree.all_files.filter(f => {
    const name = (f.split('/').pop() || '').toLowerCase();
    return /^(index|main|app|server|client|api|router|routes|schema|models?|types?|config)\.(ts|js|tsx|jsx|py|go|rs)$/.test(name) ||
           /^(dockerfile|docker-compose|makefile|justfile)$/i.test(name);
  }).slice(0, 20);

  // Fetch sample files in parallel
  const filesToSample = architecturalFiles.slice(0, 8);
  const samplePromises = filesToSample.map(path => getFile(owner, repo, path));
  const samples = (await Promise.all(samplePromises)).filter((s): s is CodeSample => s !== null);

  return {
    repo: metadata,
    readme,
    structure: {
      total_files: tree.total_files,
      project_type: projectType,
      main_directories: srcDirs,
      all_top_level: tree.top_level_dirs,
      key_files: architecturalFiles
    },
    code_samples: samples,
    summary: {
      file_count: tree.total_files,
      has_tests: tree.all_files.some(f => /test|spec|__tests__/i.test(f)),
      has_ci: tree.all_files.some(f => /\.github\/workflows|\.gitlab-ci|jenkinsfile|\.circleci/i.test(f)),
      has_docs: tree.all_files.some(f => /^docs?\//i.test(f) || /readme/i.test(f)),
      has_docker: tree.all_files.some(f => /dockerfile/i.test(f))
    }
  };
}

/**
 * Format the digest as context for the LLM.
 * This produces a clean, readable summary for article generation.
 */
export function formatDigestForLLM(digest: RepoDigest): string {
  const sections: string[] = [];

  // Repo overview
  sections.push(`## Repository: ${digest.repo.name}`);
  sections.push(`**URL:** ${digest.repo.url}`);
  sections.push(`**Description:** ${digest.repo.description || 'No description'}`);
  sections.push(`**Language:** ${digest.repo.language || 'Unknown'}`);
  sections.push(`**Stars:** ${digest.repo.stars.toLocaleString()} | **Forks:** ${digest.repo.forks.toLocaleString()}`);
  if (digest.repo.topics.length > 0) {
    sections.push(`**Topics:** ${digest.repo.topics.join(', ')}`);
  }
  sections.push(`**License:** ${digest.repo.license || 'Unknown'}`);
  sections.push(`**Created:** ${new Date(digest.repo.created).toLocaleDateString()}`);
  sections.push('');

  // Project structure
  sections.push(`## Project Structure`);
  sections.push(`**Type:** ${digest.structure.project_type}`);
  sections.push(`**Total Files:** ${digest.structure.total_files}`);
  sections.push(`**Main Directories:** ${digest.structure.main_directories.join(', ') || 'root-level'}`);
  sections.push(`**Key Files:** ${digest.structure.key_files.slice(0, 10).join(', ')}`);
  sections.push('');

  // Quality indicators
  sections.push(`## Quality Indicators`);
  sections.push(`- Tests: ${digest.summary.has_tests ? '✅ Yes' : '❌ No'}`);
  sections.push(`- CI/CD: ${digest.summary.has_ci ? '✅ Yes' : '❌ No'}`);
  sections.push(`- Documentation: ${digest.summary.has_docs ? '✅ Yes' : '❌ No'}`);
  sections.push(`- Docker: ${digest.summary.has_docker ? '✅ Yes' : '❌ No'}`);
  sections.push('');

  // README excerpt
  if (digest.readme) {
    sections.push(`## README (excerpt)`);
    sections.push('```');
    sections.push(digest.readme.slice(0, 2000));
    sections.push('```');
    sections.push('');
  }

  // Code samples
  if (digest.code_samples.length > 0) {
    sections.push(`## Key Code Samples`);
    for (const sample of digest.code_samples.slice(0, 5)) {
      sections.push(`### ${sample.path} (${sample.lines} lines)`);
      if (sample.exports.length > 0) {
        sections.push(`**Exports:** ${sample.exports.map(e => e.name).join(', ')}`);
      }
      if (sample.imports.length > 0) {
        sections.push(`**Imports:** ${sample.imports.join(', ')}`);
      }
      sections.push('```');
      sections.push(sample.content.slice(0, 1000));
      sections.push('```');
      sections.push('');
    }
  }

  return sections.join('\n');
}
