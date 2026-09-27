import asyncio, sys, json
from playwright.async_api import async_playwright
SHIM = r"""
(() => {
  const id = 'p' + Math.random().toString(36).slice(2, 8);
  const bc = new BroadcastChannel('fc-room');
  const my = {}; const map = new Map(); const hs = [];
  const snap = () => [...map.values()];
  const fire = () => setTimeout(() => { const ps = snap(); hs.forEach((h) => h({ peers: ps, joined: [], left: [], updated: ps })); }, 30 + Math.random() * 120);
  const self = () => ({ peer: id, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze(JSON.parse(JSON.stringify(my))), updatedAt: Date.now() });
  map.set(id, self());
  const send = () => bc.postMessage({ id, presence: my });
  bc.onmessage = (e) => { const d = e.data; map.set(d.id, { peer: d.id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(d.presence), updatedAt: Date.now() }); fire(); };
  setInterval(send, 700);
  const room = {
    presence: async (patch) => { for (const k in patch) { if (patch[k] === null) delete my[k]; else my[k] = patch[k]; } if (JSON.stringify(my).length > 4096) throw { code: 'invalid_argument' }; map.set(id, self()); send(); fire(); },
    peers: snap, onPeers: (h) => { hs.push(h); fire(); return () => {}; },
  };
  window.claude = { use: async (n) => (n === 'room' ? room : null) };
})();
"""
async def st(pg):
    return await pg.evaluate("(()=>{const G=window.__fc.G;if(!G.T)return null;return {ph:G.phase,inn:G.inning,half:G.half,o:G.outs,b:G.b,s:G.s,r:[G.T[0].runs,G.T[1].runs],line:G.T.map(t=>t.line.join('')),bases:G.bases.map(x=>x?x.name:'-').join(','),pi:G.online?G.online.pi:-1}})()")
async def main():
    url=sys.argv[1]
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=await b.new_context(viewport={'width':390,'height':844})
        await ctx.add_init_script(SHIM)
        A=await ctx.new_page(); B=await ctx.new_page()
        logs=[]
        for n,pg in (('A',A),('B',B)): pg.on('pageerror', lambda e,n=n: logs.append(n+' ERR '+str(e)))
        await A.goto(url+'#auto&fast&speed=4&mode=none&inn='+sys.argv[2]+'&home=1'); await B.goto(url+'#auto&fast&speed=4&mode=none&inn=1&home=0')
        for pg in (A,B): await pg.wait_for_function('window.__done===true')
        await B.evaluate("window.__fc.OPTS.me=4")
        await A.click('#onlineBtn'); await A.wait_for_timeout(500); await A.click('#onHost')
        await B.click('#onlineBtn'); await B.wait_for_selector('[data-join]', timeout=15000); await B.click('[data-join]')
        await A.wait_for_function('window.__fc.G.online', timeout=20000); await B.wait_for_function('window.__fc.G.online', timeout=20000)
        print('started')
        t=0; mism=0
        while t<int(sys.argv[3]):
            await A.wait_for_timeout(8000); t+=8
            sa,sb=await st(A),await st(B)
            same = sa and sb and sa['r']==sb['r'] and sa['inn']==sb['inn']
            print(t, 'A', json.dumps(sa,ensure_ascii=False)); print('   B', json.dumps(sb,ensure_ascii=False))
        for l in logs[:10]: print(l)
        await b.close()
asyncio.run(main())
