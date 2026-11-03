// Parses every source file with Babel to catch syntax errors (run: npm run check).
const fs = require('fs'), path = require('path'), babel = require('@babel/core');
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' || e.name === '.git' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
let bad = 0;
for (const f of [...walk('src'), 'App.js'].filter(f => f.endsWith('.js'))) {
  try { babel.transformFileSync(f, {presets: ['babel-preset-expo'], babelrc: false, configFile: false}); } catch (e) { bad++; console.error('✗', f, e.message.split('\n')[0]); }
}
console.log(bad ? `${bad} file(s) with errors` : '✓ all files parse');
process.exit(bad ? 1 : 0);
