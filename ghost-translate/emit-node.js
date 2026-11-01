const fs = require('fs');
const read = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8');
const strip = (s) => s.split('\n').filter((l) => !l.endsWith('// export') && !l.startsWith('const crypto')).join('\n');

// Code nodes cannot import files, so the library is pasted whole into each one.
function emit(name) {
  const raw = read('wrappers/' + name + '.js');
  if (raw.startsWith('// lib: access\n')) return strip(read('access.js')) + '\n' + raw.replace(/^.*\n/, '');
  return "const crypto = require('crypto');\n" + strip(read('core.js')) + '\n' + raw.replace(/^\/\/ file:.*\n/, '');
}

module.exports = { emit };
if (require.main === module) process.stdout.write(emit(process.argv[2]));
