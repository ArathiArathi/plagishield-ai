const fs = require('fs');
const path = require('path');

function patchFile(filePath, isCjs) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('createServerHistory')) return;

  const addition = isCjs
    ? "\nexports.createServerHistory = function createServerHistory(initialPath) { return exports.createMemoryHistory({ initialEntries: [initialPath || '/'] }); };\n"
    : "\nexport function createServerHistory(initialPath = '/') { return createMemoryHistory({ initialEntries: [initialPath] }); }\n";

  fs.appendFileSync(filePath, addition, 'utf8');
  console.log(`[patch-history] Patched createServerHistory into: ${filePath}`);
}

function patchDts(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('createServerHistory')) return;

  const addition = "\nexport declare function createServerHistory(initialPath?: string): RouterHistory;\n";
  fs.appendFileSync(filePath, addition, 'utf8');
  console.log(`[patch-history] Patched createServerHistory into: ${filePath}`);
}

function findAndPatch(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '@tanstack') {
        const historyDir = path.join(fullPath, 'history');
        if (fs.existsSync(historyDir)) {
          patchFile(path.join(historyDir, 'dist', 'esm', 'index.js'), false);
          patchFile(path.join(historyDir, 'dist', 'cjs', 'index.cjs'), true);
          patchDts(path.join(historyDir, 'dist', 'esm', 'index.d.ts'));
          patchDts(path.join(historyDir, 'dist', 'cjs', 'index.d.cts'));
        }
      }
      if (entry.name !== '.git' && entry.name !== '.output' && entry.name !== 'dist') {
        findAndPatch(fullPath);
      }
    }
  }
}

const rootNodeModules = path.resolve(__dirname, '..', 'node_modules');
findAndPatch(rootNodeModules);
console.log('[patch-history] Completed @tanstack/history check.');
