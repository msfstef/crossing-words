#!/usr/bin/env node
/**
 * Simple PWA validation script
 * Checks for common PWA requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

console.log('🔍 PWA Validation Report\n');
console.log('========================\n');

let score = 0;
let total = 0;

function check(name, condition, details = '') {
  total++;
  if (condition) {
    score++;
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

// Check manifest file
console.log('\n📱 Web App Manifest\n');
const manifestPath = path.join(distDir, 'manifest.webmanifest');
const manifestExists = fs.existsSync(manifestPath);
check('Manifest file exists', manifestExists);

if (manifestExists) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  check('Has name or short_name', manifest.name || manifest.short_name,
    `name: "${manifest.name || manifest.short_name}"`);

  check('Has start_url', !!manifest.start_url,
    `start_url: "${manifest.start_url}"`);

  check('Has display mode', !!manifest.display,
    `display: "${manifest.display}"`);

  check('Display mode is app-like',
    ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display),
    `display: "${manifest.display}"`);

  check('Has theme_color', !!manifest.theme_color,
    `theme_color: "${manifest.theme_color}"`);

  check('Has background_color', !!manifest.background_color,
    `background_color: "${manifest.background_color}"`);

  check('Has icons array', Array.isArray(manifest.icons) && manifest.icons.length > 0,
    `${manifest.icons?.length || 0} icons defined`);

  if (manifest.icons) {
    const has192 = manifest.icons.some(i => i.sizes?.includes('192'));
    const has512 = manifest.icons.some(i => i.sizes?.includes('512'));
    const hasMaskable = manifest.icons.some(i => i.purpose?.includes('maskable'));

    check('Has 192x192 icon', has192);
    check('Has 512x512 icon', has512);
    check('Has maskable icon', hasMaskable);
  }

  // New PWA features
  check('Has launch_handler (focus-existing)',
    manifest.launch_handler?.client_mode === 'focus-existing',
    'Links will reuse existing window');

  check('Has handle_links (preferred)',
    manifest.handle_links === 'preferred',
    'In-scope links will open in PWA');

  check('Has display_override',
    Array.isArray(manifest.display_override) && manifest.display_override.length > 0,
    `Fallback chain: ${manifest.display_override?.join(' → ')}`);

  check('Has scope', !!manifest.scope,
    `scope: "${manifest.scope}"`);

  check('Has categories', Array.isArray(manifest.categories) && manifest.categories.length > 0,
    `categories: ${manifest.categories?.join(', ')}`);

  check('Has shortcuts', Array.isArray(manifest.shortcuts) && manifest.shortcuts.length > 0,
    `${manifest.shortcuts?.length || 0} shortcuts defined`);
}

// Check icons
console.log('\n🎨 Icons\n');
check('192x192 PNG exists', fs.existsSync(path.join(distDir, 'pwa-192x192.png')));
check('512x512 PNG exists', fs.existsSync(path.join(distDir, 'pwa-512x512.png')));
check('Maskable icon exists', fs.existsSync(path.join(distDir, 'maskable-icon-512x512.png')));
check('Apple touch icon exists', fs.existsSync(path.join(distDir, 'apple-touch-icon-180x180.png')));
check('Favicon exists', fs.existsSync(path.join(distDir, 'favicon.ico')));
check('SVG icon exists', fs.existsSync(path.join(distDir, 'icon-512.svg')));

// Check service worker
console.log('\n⚙️  Service Worker\n');
const swPath = path.join(distDir, 'sw.js');
check('Service worker exists', fs.existsSync(swPath));

// Check HTML
console.log('\n📄 HTML\n');
const htmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');

  check('Has viewport meta tag', html.includes('<meta name="viewport"'));
  check('Has viewport-fit=cover', html.includes('viewport-fit=cover'),
    'Supports notched devices');
  check('Has theme-color meta tag', html.includes('<meta name="theme-color"'));
  check('Has apple-mobile-web-app-capable', html.includes('apple-mobile-web-app-capable'));
  check('Has apple-mobile-web-app-status-bar-style', html.includes('apple-mobile-web-app-status-bar-style'));
  check('Has apple touch icon link', html.includes('apple-touch-icon'));
  check('Has favicon link', html.includes('favicon.ico'));
}

// Check CSS for safe-area support
console.log('\n🎯 Safe Area Support\n');
const cssFiles = fs.readdirSync(path.join(distDir, 'assets'))
  .filter(f => f.endsWith('.css'));

if (cssFiles.length > 0) {
  const cssContent = fs.readFileSync(
    path.join(distDir, 'assets', cssFiles[0]),
    'utf8'
  );
  check('Uses safe-area-inset in CSS', cssContent.includes('safe-area-inset'),
    'Supports iPhone notch');
}

// Final score
console.log('\n========================\n');
const percentage = Math.round((score / total) * 100);
console.log(`📊 Score: ${score}/${total} (${percentage}%)\n`);

if (percentage === 100) {
  console.log('🎉 Perfect! Your PWA meets all requirements!\n');
} else if (percentage >= 80) {
  console.log('✨ Great! Your PWA meets most requirements.\n');
} else if (percentage >= 60) {
  console.log('⚠️  Good start, but some improvements needed.\n');
} else {
  console.log('❌ Significant improvements needed.\n');
}

process.exit(percentage === 100 ? 0 : 1);
