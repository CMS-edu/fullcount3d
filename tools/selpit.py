import json, sys
m=json.load(open('data/merged.json'))
TEAMS=['LG','HH','SSG','SS','NC','KT','LT','KIA','OB','KW']
AG_P={'LG':['Kim Young-woo'],'SSG':['Jo Byeong-hyeon'],'SS':['Bae Chan-seung'],'KT':['Park Yeong-hyun','So Hyeong-jun','Oh Won-seok'],'LT':['Choi Jun-yong','Kim Jin-uk'],'KIA':['Sung Yeong-tak'],'OB':['Gwak Been','Choi Min-seok']}
def hitters(t): return [v for v in m['hit'].values() if v['team']==t]
def pitchers(t): return [v for v in m['pit'].values() if v['team']==t]
def pick_pitchers(t):
    ps=pitchers(t)
    def is_sp(p):
        r=p['role'] or ''
        if 'SP' in r: return True
        return p['src']=='k' and p['ip']>=60 and p['sv']==0
    sp=[p for p in ps if is_sp(p)]
    sp.sort(key=lambda p:(0 if (p['role']=='SP' or p['src']=='k') else 1, -p['ip']))
    rot=sp[:5]
    rest=[p for p in ps if p not in rot]
    cl=max(rest,key=lambda p:(p['sv'], p['role']=='CP', p['ip']))
    rp=[p for p in rest if p is not cl and p['ip']>=10]
    rp.sort(key=lambda p:-(p['ip']*(1.0 if (p['era'] or 9)<6 else 0.6)))
    return rot, rp[:5]+[cl]
if __name__=='__main__':
    for t in TEAMS:
        rot,pen=pick_pitchers(t)
        print(t,'ROT',[ (p['eng'],round(p['ip'])) for p in rot])
        print(t,'PEN',[ (p['eng'],round(p['ip']),p['sv']) for p in pen])
