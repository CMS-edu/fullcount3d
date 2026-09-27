// build.py와 같은 일을 하는 Node 버전 (Render 서버에는 Python이 없을 수 있어서)
//   node build.js --local -o dist/index.html   ← 서버 배포용 (dist/three.min.js를 옆 파일로 참조)
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const parts = fs.readdirSync(path.join(__dirname, 'src')).filter((f) => /^g.*\.js$/.test(f)).sort();
const game = "(function(){\n'use strict';\n" + parts.map((f) => rd('src/' + f)).join('') + '})();';
const esc = (s) => s.split('</script').join('<\/script');
let three;
if (has('--local')) three = '<script src="three.min.js"></script>';
else if (has('--inline')) three = '<script>' + esc(rd('dist/three.min.js')) + '</script>';
else three = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
// replace()에 함수를 넘겨야 코드 속 $& 같은 문자열이 치환 패턴으로 해석되지 않음
const out = rd('template.html').replace('<!--THREE-->', () => three).replace('/*SIM*/', () => esc(rd('sim.js'))).replace('/*GAME*/', () => esc(game));
const dst = path.join(__dirname, has('-o') ? argv[argv.indexOf('-o') + 1] : 'dist/index.html');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, out);
console.log('wrote', path.relative(__dirname, dst), out.length);
