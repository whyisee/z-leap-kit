const PANEL_VIEW_TYPE = 'leapHome.homePanel';
const LEAP_DATA_DIR = '.leap';
const LEAP_STATE_FILE = 'state.json';
const FAVORITES_KEY = 'leapHome.favorites';
const RECENT_KEY = 'leapHome.recent';
const SCAN_LIMIT_PER_SOURCE = 2000;
const SEARCH_CONTENT_LIMIT = 65536;
const MAX_INDEXED_FILE_BYTES = 1024 * 1024;

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mdc']);
const PROMPT_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mdc', '.txt', '.prompt']);
const WORKSPACE_TEXT_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  ...PROMPT_EXTENSIONS,
  '.astro',
  '.bash',
  '.c',
  '.cc',
  '.cfg',
  '.clj',
  '.cljs',
  '.cmake',
  '.conf',
  '.cpp',
  '.cs',
  '.css',
  '.csv',
  '.cts',
  '.dart',
  '.dockerignore',
  '.editorconfig',
  '.elm',
  '.erb',
  '.fish',
  '.gql',
  '.go',
  '.graphql',
  '.h',
  '.hpp',
  '.html',
  '.ini',
  '.java',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.kt',
  '.kts',
  '.less',
  '.lua',
  '.mjs',
  '.mts',
  '.php',
  '.pl',
  '.prisma',
  '.proto',
  '.ps1',
  '.py',
  '.rb',
  '.rs',
  '.sass',
  '.scala',
  '.scss',
  '.sh',
  '.sql',
  '.svelte',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.vue',
  '.xml',
  '.yaml',
  '.yml',
  '.zsh'
]);
const WORKSPACE_TEXT_FILE_NAMES = new Set([
  '.babelrc',
  '.dockerignore',
  '.editorconfig',
  '.env',
  '.env.example',
  '.eslintignore',
  '.eslintrc',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc',
  'dockerfile',
  'gemfile',
  'makefile',
  'procfile',
  'rakefile'
]);
const SKIPPED_WORKSPACE_FILE_NAMES = new Set([
  'bun.lockb',
  'cargo.lock',
  'composer.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock'
]);
const EXCLUDED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  LEAP_DATA_DIR,
  '.hg',
  '.next',
  '.svn',
  '.turbo',
  '.vscode-test',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'vendor'
]);

module.exports = {
  EXCLUDED_DIRECTORIES,
  FAVORITES_KEY,
  LEAP_DATA_DIR,
  LEAP_STATE_FILE,
  MARKDOWN_EXTENSIONS,
  MAX_INDEXED_FILE_BYTES,
  PANEL_VIEW_TYPE,
  PROMPT_EXTENSIONS,
  RECENT_KEY,
  SCAN_LIMIT_PER_SOURCE,
  SEARCH_CONTENT_LIMIT,
  SKIPPED_WORKSPACE_FILE_NAMES,
  WORKSPACE_TEXT_EXTENSIONS,
  WORKSPACE_TEXT_FILE_NAMES
};
