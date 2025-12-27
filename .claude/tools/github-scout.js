#!/usr/bin/env node

/**
 * GitHub Scout - Curiosity-driven repository explorer
 *
 * Usage:
 *   ./github-scout.js tree <owner> <repo>           # Get repository file tree
 *   ./github-scout.js file <owner> <repo> <path>    # Get file contents
 *   ./github-scout.js files <owner> <repo> <paths>  # Get multiple files (comma-separated)
 *   ./github-scout.js search <owner> <repo> <query> # Search code in repo
 *   ./github-scout.js overview <owner> <repo>       # Quick overview (tree + key files)
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'GitHub-Scout/1.0',
  ...(GITHUB_TOKEN && { 'Authorization': `Bearer ${GITHUB_TOKEN}` })
};

async function fetchGitHub(endpoint) {
  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  return response.json();
}

async function getTree(owner, repo) {
  try {
    const data = await fetchGitHub(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);

    // Organize into a structured view
    const files = data.tree
      .filter(item => item.type === 'blob')
      .map(item => ({
        path: item.path,
        size: item.size
      }));

    const dirs = [...new Set(data.tree
      .filter(item => item.type === 'tree')
      .map(item => item.path)
    )];

    // Identify key files
    const keyFiles = files.filter(f =>
      /^(readme|package\.json|cargo\.toml|go\.mod|pyproject\.toml|requirements\.txt|composer\.json|gemfile|makefile|dockerfile)$/i.test(f.path.split('/').pop()) ||
      /^src\/(index|main|app|server)\.(ts|js|tsx|jsx|py|go|rs)$/.test(f.path) ||
      /^(index|main|app|server)\.(ts|js|tsx|jsx|py|go|rs)$/.test(f.path)
    );

    return {
      total_files: files.length,
      total_dirs: dirs.length,
      top_level_dirs: dirs.filter(d => !d.includes('/')),
      key_files: keyFiles.map(f => f.path),
      all_files: files.map(f => f.path),
      truncated: data.truncated || false
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function getFile(owner, repo, path) {
  try {
    const data = await fetchGitHub(`/repos/${owner}/${repo}/contents/${path}`);

    if (data.type !== 'file') {
      return { error: `${path} is not a file` };
    }

    // Decode base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    // Security: Extract structural info, minimize raw content exposure
    const lines = content.split('\n');
    const summary = {
      path: data.path,
      size: data.size,
      lines: lines.length,
      content: content
    };

    // For code files, try to extract exports/signatures
    if (/\.(ts|js|tsx|jsx)$/.test(path)) {
      summary.exports = extractJSExports(content);
      summary.imports = extractJSImports(content);
    } else if (/\.py$/.test(path)) {
      summary.exports = extractPythonExports(content);
      summary.imports = extractPythonImports(content);
    } else if (/\.(go)$/.test(path)) {
      summary.exports = extractGoExports(content);
      summary.imports = extractGoImports(content);
    }

    return summary;
  } catch (error) {
    return { error: error.message, path };
  }
}

async function getFiles(owner, repo, paths) {
  const pathList = paths.split(',').map(p => p.trim());
  const results = await Promise.all(
    pathList.map(path => getFile(owner, repo, path))
  );
  return results;
}

async function searchCode(owner, repo, query) {
  try {
    const data = await fetchGitHub(`/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`);

    return {
      total_count: data.total_count,
      matches: data.items.slice(0, 10).map(item => ({
        path: item.path,
        name: item.name,
        url: item.html_url
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function getOverview(owner, repo) {
  // Get tree first
  const tree = await getTree(owner, repo);
  if (tree.error) return tree;

  // Fetch key files in parallel
  const filesToFetch = tree.key_files.slice(0, 5); // Limit to 5 key files
  const fileContents = await Promise.all(
    filesToFetch.map(path => getFile(owner, repo, path))
  );

  // Detect project type
  const projectType = detectProjectType(tree.all_files);

  return {
    structure: {
      total_files: tree.total_files,
      top_level_dirs: tree.top_level_dirs,
      key_files: tree.key_files
    },
    project_type: projectType,
    key_file_contents: fileContents.filter(f => !f.error)
  };
}

function detectProjectType(files) {
  const fileSet = new Set(files.map(f => f.split('/').pop()));

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

function extractJSExports(content) {
  const exports = [];

  // ES6 Named exports: export const/function/class name
  const namedExportRegex = /export\s+(const|let|var|function|class|type|interface)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ type: match[1], name: match[2] });
  }

  // ES6 Default exports: export default
  if (/export\s+default/.test(content)) {
    exports.push({ type: 'default', name: 'default' });
  }

  // ES6 Re-exports: export { ... } from
  const reExportRegex = /export\s*\{([^}]+)\}\s*from/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
    names.forEach(name => exports.push({ type: 're-export', name }));
  }

  // CommonJS: module.exports = ...
  if (/module\.exports\s*=/.test(content)) {
    exports.push({ type: 'commonjs', name: 'module.exports' });
  }

  // CommonJS: exports.name = ...
  const cjsExportRegex = /exports\.(\w+)\s*=/g;
  while ((match = cjsExportRegex.exec(content)) !== null) {
    exports.push({ type: 'commonjs', name: match[1] });
  }

  return exports;
}

function extractJSImports(content) {
  const imports = [];

  // ES6: import { ... } from 'module'
  // ES6: import name from 'module'
  const importRegex = /import\s+(?:(\w+)|{([^}]+)}|\*\s+as\s+(\w+))?\s*(?:,\s*{([^}]+)})?\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const module = match[5];
    imports.push(module);
  }

  // CommonJS: require('module')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
}

function extractPythonExports(content) {
  const exports = [];

  // Class definitions: class ClassName
  const classRegex = /^class\s+(\w+)/gm;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push({ type: 'class', name: match[1] });
  }

  // Function definitions: def function_name
  const funcRegex = /^def\s+(\w+)/gm;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push({ type: 'function', name: match[1] });
  }

  // __all__ exports
  const allRegex = /__all__\s*=\s*\[([^\]]+)\]/;
  const allMatch = content.match(allRegex);
  if (allMatch) {
    const names = allMatch[1].match(/['"](\w+)['"]/g);
    if (names) {
      names.forEach(n => exports.push({ type: '__all__', name: n.replace(/['"]/g, '') }));
    }
  }

  return exports;
}

function extractPythonImports(content) {
  const imports = [];

  // import module
  const importRegex = /^import\s+([\w.]+)/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // from module import ...
  const fromRegex = /^from\s+([\w.]+)\s+import/gm;
  while ((match = fromRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
}

function extractGoExports(content) {
  const exports = [];

  // Exported functions (capitalized): func FunctionName
  const funcRegex = /^func\s+(\([^)]+\)\s+)?([A-Z]\w*)/gm;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push({ type: 'func', name: match[2] });
  }

  // Exported types: type TypeName
  const typeRegex = /^type\s+([A-Z]\w*)/gm;
  while ((match = typeRegex.exec(content)) !== null) {
    exports.push({ type: 'type', name: match[1] });
  }

  // Exported vars/consts
  const varRegex = /^(?:var|const)\s+([A-Z]\w*)/gm;
  while ((match = varRegex.exec(content)) !== null) {
    exports.push({ type: 'var', name: match[1] });
  }

  return exports;
}

function extractGoImports(content) {
  const imports = [];

  // Single import: import "package"
  const singleRegex = /import\s+"([^"]+)"/g;
  let match;
  while ((match = singleRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Import block: import ( ... )
  const blockRegex = /import\s*\(([\s\S]*?)\)/g;
  while ((match = blockRegex.exec(content)) !== null) {
    const block = match[1];
    const pkgRegex = /"([^"]+)"/g;
    let pkg;
    while ((pkg = pkgRegex.exec(block)) !== null) {
      imports.push(pkg[1]);
    }
  }

  return [...new Set(imports)];
}

async function getRepoMetadata(owner, repo) {
  try {
    const data = await fetchGitHub(`/repos/${owner}/${repo}`);
    return {
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      open_issues: data.open_issues_count,
      created_at: data.created_at,
      updated_at: data.updated_at,
      topics: data.topics || [],
      license: data.license?.name || null,
      homepage: data.homepage || null,
      default_branch: data.default_branch
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function getReadme(owner, repo) {
  try {
    const data = await fetchGitHub(`/repos/${owner}/${repo}/readme`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    // Truncate if too long (keep first ~4000 chars for context)
    return content.length > 4000 ? content.slice(0, 4000) + '\n\n[... truncated ...]' : content;
  } catch (error) {
    return null; // README not found is ok
  }
}

async function getDigest(owner, repo) {
  // Fetch everything in parallel for speed
  const [metadata, readme, tree] = await Promise.all([
    getRepoMetadata(owner, repo),
    getReadme(owner, repo),
    getTree(owner, repo)
  ]);

  if (metadata.error) return metadata;
  if (tree.error) return tree;

  // Detect project type
  const projectType = detectProjectType(tree.all_files);

  // Identify interesting directories
  const srcDirs = tree.top_level_dirs.filter(d =>
    /^(src|lib|app|pkg|cmd|internal|packages|modules|core)$/i.test(d)
  );

  // Find entry points and key architectural files
  const architecturalFiles = tree.all_files.filter(f => {
    const name = f.split('/').pop().toLowerCase();
    return /^(index|main|app|server|client|api|router|routes|schema|models?|types?|config)\.(ts|js|tsx|jsx|py|go|rs)$/.test(name) ||
           /^(dockerfile|docker-compose|makefile|justfile)$/i.test(name) ||
           /\.(proto|graphql|openapi|swagger)\.(yaml|yml|json)?$/.test(name);
  }).slice(0, 20); // Limit to 20

  // Fetch a sample of key files to understand architecture
  const filesToSample = architecturalFiles.slice(0, 8);
  const samples = await Promise.all(
    filesToSample.map(path => getFile(owner, repo, path))
  );

  // Build the digest
  return {
    // Metadata for article intro
    repo: {
      owner,
      name: metadata.name,
      url: `https://github.com/${owner}/${repo}`,
      description: metadata.description,
      language: metadata.language,
      stars: metadata.stars,
      forks: metadata.forks,
      topics: metadata.topics,
      license: metadata.license,
      created: metadata.created_at,
      last_updated: metadata.updated_at
    },

    // README for understanding purpose
    readme: readme,

    // Structure for understanding architecture
    structure: {
      total_files: tree.total_files,
      project_type: projectType,
      main_directories: srcDirs,
      all_top_level: tree.top_level_dirs,
      key_files: architecturalFiles
    },

    // Code samples with exports/imports for technical depth
    code_samples: samples
      .filter(s => !s.error)
      .map(s => ({
        path: s.path,
        lines: s.lines,
        exports: s.exports || [],
        imports: s.imports || [],
        // Include content but truncated for very long files
        content: s.content?.length > 2000
          ? s.content.slice(0, 2000) + '\n// ... truncated ...'
          : s.content
      })),

    // Summary stats for quick reference
    summary: {
      file_count: tree.total_files,
      has_tests: tree.all_files.some(f => /test|spec|__tests__/i.test(f)),
      has_ci: tree.all_files.some(f => /\.github\/workflows|\.gitlab-ci|jenkinsfile|\.circleci/i.test(f)),
      has_docs: tree.all_files.some(f => /^docs?\//i.test(f) || /readme/i.test(f)),
      has_docker: tree.all_files.some(f => /dockerfile/i.test(f))
    }
  };
}

// Main CLI handler
async function main() {
  const [,, command, ...args] = process.argv;

  let result;

  switch (command) {
    case 'tree':
      result = await getTree(args[0], args[1]);
      break;
    case 'file':
      result = await getFile(args[0], args[1], args[2]);
      break;
    case 'files':
      result = await getFiles(args[0], args[1], args[2]);
      break;
    case 'search':
      result = await searchCode(args[0], args[1], args.slice(2).join(' '));
      break;
    case 'overview':
      result = await getOverview(args[0], args[1]);
      break;
    case 'digest':
      result = await getDigest(args[0], args[1]);
      break;
    case 'metadata':
      result = await getRepoMetadata(args[0], args[1]);
      break;
    default:
      result = {
        error: 'Unknown command',
        usage: [
          'tree <owner> <repo>           - Get repository file tree',
          'file <owner> <repo> <path>    - Get file contents',
          'files <owner> <repo> <paths>  - Get multiple files (comma-separated)',
          'search <owner> <repo> <query> - Search code in repo',
          'overview <owner> <repo>       - Quick overview (tree + key files)',
          'digest <owner> <repo>         - Full article-ready digest',
          'metadata <owner> <repo>       - Just repo metadata (stars, description, etc)'
        ]
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});
