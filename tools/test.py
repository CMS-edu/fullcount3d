import sys, asyncio, time, json
from playwright.async_api import async_playwright
# 사용: python3 test.py URL WxH hash maxsec tag [want,...]
async def main():
    url, wh, hashv, maxs, tag = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
    want = sys.argv[6].split(',') if len(sys.argv) > 6 else []
    w, h = map(int, wh.split('x'))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) and '403' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e) + ' ' + (e.stack or '')[:700]))
        await pg.goto(url + '#' + hashv)
        await pg.wait_for_function('window.__done===true', timeout=60000)
        seen = {}; t0 = time.time(); last = None
        while time.time() - t0 < maxs:
            st = await pg.evaluate('(()=>{const f=window.__fc;const G=f.G;return {ph:G.phase,inn:G.inning,half:G.half,o:G.outs,b:G.b,s:G.s,cam:f.CAM.mode,sc:G.T?[G.T[0].runs,G.T[1].runs]:null,kind:G.play?G.play.res.kind:(G.adv?G.adv.adv.kind:null),over:!!window.__over,call:document.querySelector("#call").textContent}})()')
            key = st['ph'] + (':' + st['kind'] if st['kind'] else '')
            if key not in seen:
                seen[key] = 1
                if any(wk in key for wk in want):
                    await pg.wait_for_timeout(700)
                    await pg.screenshot(path=f'shots/{tag}_{key.replace(":","_")}.png')
            else: seen[key] += 1
            last = st
            if st['over']:
                await pg.wait_for_timeout(2500); await pg.screenshot(path=f'shots/{tag}_over.png'); break
            await pg.wait_for_timeout(100)
        print('final', json.dumps(last, ensure_ascii=False), 'elapsed', round(time.time() - t0))
        print('seen', sorted(seen.keys()))
        for l in logs[:15]: print('LOG', l[:900])
        await b.close()
asyncio.run(main())
