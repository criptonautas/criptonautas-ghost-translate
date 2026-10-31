const fs = require('fs');
// Code nodes cannot import files, so core.js is pasted whole into each one.
const core = fs.readFileSync(__dirname + '/core.js', 'utf8')
  .split('\n')
  .filter((l) => !l.endsWith('// export') && !l.startsWith('const crypto'))
  .join('\n');
const wrapper = fs.readFileSync(__dirname + '/wrappers/' + process.argv[2] + '.js', 'utf8').replace(/^\/\/ file:.*\n/, '');
process.stdout.write("const crypto = require('crypto');\n" + core + '\n' + wrapper);
