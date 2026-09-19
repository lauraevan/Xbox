import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'dist');

const protectedFiles = new Set([
  'js/store.js',
  'js/nav.js',
  'js/stratus.js',
  'js/stratus-backend-pass.js',
  'js/home-row-custom.js',
  'js/cloud-library.js',
  'js/store-console-pass.js',
  'js/flagship-launch-pass.js'
]);

const copyDirs = ['assets', 'css', 'games', 'js'];
const copyFiles = ['index.html', 'manifest.webmanifest'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const dir of copyDirs) {
  const from = path.join(root, dir);
  if (fs.existsSync(from)) {
    fs.cpSync(from, path.join(out, dir), { recursive: true });
  }
}

for (const file of copyFiles) {
  const from = path.join(root, file);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(out, file));
  }
}

// Only the catalogue is needed by the browser. Do not publish the vendored
// Stratus backend source, docs, package files, or repository metadata.
const stratusOut = path.join(out, 'stratus');
fs.mkdirSync(stratusOut, { recursive: true });
fs.copyFileSync(
  path.join(root, 'stratus', 'cloud.json'),
  path.join(stratusOut, 'cloud.json')
);

for (const rel of protectedFiles) {
  const sourcePath = path.join(root, rel);
  const outputPath = path.join(out, rel);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Protected file is missing: ${rel}`);
  }

  const source = fs.readFileSync(sourcePath, 'utf8');
  const marked = 'void "XBOX-PROTECTED-EVANINC-2026-V1";\n' + source;

  const result = JavaScriptObfuscator.obfuscate(marked, {
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.85,
    rotateStringArray: true,
    shuffleStringArray: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    transformObjectKeys: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    sourceMap: false
  });

  fs.writeFileSync(outputPath, result.getObfuscatedCode(), 'utf8');
}

console.log(
  `Protected production build created. Obfuscated ${protectedFiles.size} files; source maps disabled.`
);
