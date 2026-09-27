import sys, glob, os
local = '--local' in sys.argv
parts = sorted(glob.glob('src/g*.js'))
body = "".join(open(p).read() for p in parts)
game = "(function(){\n'use strict';\n" + body + "})();"
open('build_game.js','w').write(game)
tpl = open('template.html').read()
if local: three = '<script src="three.min.js"></script>'
elif '--inline' in sys.argv: three = '<script>' + open('dist/three.min.js').read().replace('</script','<\\/script') + '</script>'
else: three = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
out = tpl.replace('<!--THREE-->', three, 1).replace('/*SIM*/', open('sim.js').read().replace('</script','<\\/script'), 1).replace('/*GAME*/', game.replace('</script','<\\/script'), 1)
dst = sys.argv[sys.argv.index('-o')+1] if '-o' in sys.argv else 'dist/index.html'
os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
open(dst,'w').write(out)
print('wrote', dst, len(out))
