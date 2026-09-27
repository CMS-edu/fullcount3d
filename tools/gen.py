import json, sys
sys.path.insert(0,'data'); sys.path.insert(0,'tools')
from names import KO, THROWS
from selpit import pick_pitchers
m=json.load(open('data/merged.json'))
TEAMS=['LG','HH','SSG','SS','NC','KT','LT','KIA','OB','KW']
POSFIX={'Lee Woo-sung':'LF'}
def ko(v):
    return KO.get(v['eng']+'|'+v['team']) or KO.get(v['eng'])
lineups={}
for line in open('data/lineups.txt'):
    if line.startswith('#') or not line.strip(): continue
    t,d,o,n,pos=line.strip().split('|'); lineups.setdefault(t,[]).append((int(o),n,pos,d))
out={}; report=[]
for t in TEAMS:
    hs=[v for v in m['hit'].values() if v['team']==t]
    byko={}
    for v in hs:
        k=ko(v)
        if not k: continue
        k=k.rstrip('*')
        if k in byko: report.append(('dup',t,k)); 
        byko.setdefault(k,v)
    lu=[]
    for o,n,pos,d in sorted(lineups[t]):
        v=byko.get(n)
        if not v: raise SystemExit(f'lineup player missing: {t} {n}')
        lu.append((v,pos))
    used={id(v) for v,_ in lu}
    rest=sorted([v for v in hs if id(v) not in used and ko(v) and v['pa']>=20], key=lambda v:-v['pa'])
    bench=rest[:4]
    if not any(v['pos']=='C' for v in bench):
        cs=[v for v in rest if v['pos']=='C']
        if cs: bench=bench[:3]+[cs[0]]
    rot,pen=pick_pitchers(t)
    def H(v,pos):
        pos = pos or {'IF':'2B','OF':'LF',None:POSFIX.get(v['eng'],'LF')}.get(v['pos'],v['pos'])
        return dict(n=ko(v).rstrip('*'), e=v['eng'], num=v.get('num') or '', pos=pos, b=(v.get('bats') or 'R')[0].replace('S','R') if (v.get('bats') or 'R')[0]!='S' else 'S',
                    pa=v['pa'], avg=v['avg'], obp=v['obp'], slg=v['slg'], hr=v['hr'], sb=v.get('sb',0), bb=v.get('bb'), so=v.get('so'))
    def P(v,role):
        thr=(v.get('thr') or THROWS.get(v['eng']) or 'R')[0]
        return dict(n=ko(v).rstrip('*'), e=v['eng'], num=v.get('num') or '', t=thr, role=role, ip=round(v['ip'],2), era=v['era'], whip=v['whip'], k=v['k'], bb=v['bb'], sv=v.get('sv',0))
    missing=[x['eng'] for x in bench+rot+pen if not ko(x)]
    if missing: raise SystemExit(f'no ko name: {t} {missing}')
    out[t]=dict(lineup=[H(v,pos) for v,pos in lu], bench=[H(v,None) for v in bench], rotation=[P(v,'SP') for v in rot], bullpen=[P(v,'CL' if i==len(pen)-1 else 'RP') for i,v in enumerate(pen)], date=lineups[t][0][3])
for t in TEAMS:
    d=out[t]
    print(t, d['date'], 'LU', ' '.join(f"{x['n']}({x['pos']})" for x in d['lineup']))
    print('   BN', ' '.join(f"{x['n']}({x['pos']},{x['pa']})" for x in d['bench']), '| SP', ' '.join(x['n'] for x in d['rotation']), '| RP', ' '.join(x['n']+('(CL)' if x['role']=='CL' else '') for x in d['bullpen']))
print(report)
js='/* ===================== REAL DATA (2026 KBO, 아시안게임 대표팀 소집 전) =====================\n'
js+='   출처: mykbostats.com 팀·리더보드·경기 페이지(2026.9.24~27 조회), 라인업 일부는 스타뉴스·스포티비뉴스 기사.\n'
js+='   기록은 실제 시즌 누적 기록. 능력치(컨택·파워·선구·주력·구속·제구·구위)는 이 기록에서 계산한 게임용 추정치. */\n'
js+='const REAL_DATE = "2026-09-13";\nconst REAL = '+json.dumps([out[t] for t in TEAMS],ensure_ascii=False,separators=(',',':'))+';\n'
open('src/g4_data.js','w').write(js)
print('wrote', len(js))
