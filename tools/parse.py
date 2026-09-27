import re, json, os
D='data/'
TEAMS=['LG','HH','SSG','SS','NC','KT','LT','KIA','OB','KW']   # sim.js TEAMS 순서
FULL={'LG':'LG Twins','HH':'Hanwha Eagles','SSG':'SSG Landers','SS':'Samsung Lions','NC':'NC Dinos','KT':'KT Wiz','LT':'Lotte Giants','KIA':'Kia Tigers','OB':'Doosan Bears','KW':'Kiwoom Heroes'}
REV={v:k for k,v in FULL.items()}
def ip(s):
    s=s.strip().replace(' ','')
    if s in ('—',''): return 0.0
    f=0
    if s.endswith('⅓'): f=1/3; s=s[:-1]
    elif s.endswith('⅔'): f=2/3; s=s[:-1]
    return (float(s) if s else 0)+f
def num(s):
    s=s.strip()
    if s in ('—',''): return None
    return float(s)
def norm(n): return re.sub(r'[^a-z]','',n.lower().replace('í','i').replace('á','a').replace('é','e').replace('ó','o').replace('ú','u'))
hit={}; pit={}
for t in TEAMS:
    for line in open(D+f'roster_{t}.txt'):
        p=line.strip().split('|')
        if p[0]=='H':
            _,n,name,pos,bats,avg,obp,slg,ops,pa,h,hr,rbi,bb,so=p
            if pa=='—': continue
            hit[(t,norm(name))]=dict(team=t,eng=name,num=n.lstrip('#'),pos=pos,bats=bats[0],avg=num(avg),obp=num(obp),slg=num(slg),pa=int(pa),h=int(h),hr=int(hr),rbi=int(rbi),bb=int(bb),so=int(so),src='roster')
        elif p[0]=='P':
            _,n,name,role,thr,era,whip,ipp,so,bb=p[:10]
            pit[(t,norm(name))]=dict(team=t,eng=name,num=n.lstrip('#'),role=role,thr=thr[0],era=num(era),whip=num(whip),ip=ip(ipp),k=int(so),bb=int(bb),src='roster')
# 리그 리더보드(OPS)로 보강/덮어쓰기 (라이브 수치)
for line in open(D+'ops.txt'):
    if line.startswith('#'): continue
    p=line.strip().split('|'); _,name,team,ops,ba,obp,slg,s1,d2,d3,hr,bb,hbp,ab,pa=p
    t=REV[team]; k=(t,norm(name)); r=hit.get(k,dict(team=t,eng=name,num=None,pos=None,bats=None,src='ops'))
    r.update(avg=float(ba),obp=float(obp),slg=float(slg),hr=int(hr),bb=int(bb),pa=int(pa),ab=int(ab)); hit[k]=r
for line in open(D+'players_extra.txt'):
    if line.startswith('#'): continue
    p=line.strip().split('|'); eng,ko,t,n,pos,bt,G,PA,AB,R,H,d2,d3,HR,RBI,SB,CS,BB,SO,AVG,OBP,SLG,OPS=p
    k=(t,norm(eng)); r=hit.get(k)
    if r is None or r['src']!='ops':
        r=r or {}; r.update(team=t,eng=eng,num=n,pos=pos,bats=bt[0],avg=float(AVG),obp=float(OBP),slg=float(SLG),pa=int(PA),hr=int(HR),bb=int(BB),so=int(SO),src='page'); hit[k]=r
    else:
        r.update(num=n,pos=pos,bats=bt[0],so=int(SO)) 
    r['ko']=ko; r['sb_page']=int(SB)
sb={}
for line in open(D+'sb.txt'):
    if line.startswith('#'): continue
    p=line.strip().split('|'); sb[(REV[p[2]],norm(p[1]))]=int(p[3])
for k,r in hit.items(): r['sb']=sb.get(k, r.get('sb_page',0))
# 투수: K 리더보드로 보강
for line in open(D+'k.txt'):
    if line.startswith('#'): continue
    p=line.strip().split('|'); _,name,team,K,BB,HB,kbb,ERA,WHIP,IP,ER,R,H,HR=p
    t=REV[team]; k=(t,norm(name)); r=pit.get(k)
    if r is None: pit[k]=dict(team=t,eng=name,num=None,role=None,thr=None,era=float(ERA),whip=float(WHIP),ip=ip(IP),k=int(K),bb=int(BB),src='k')
sv={}
for line in open(D+'sv.txt'):
    if line.startswith('#'): continue
    p=line.strip().split('|'); sv[(REV[p[1]],norm(p[0]))]=(int(p[2]),int(p[3]))
for k,r in pit.items(): r['sv'],r['g']=sv.get(k,(0,None))
json.dump({'hit':{f'{a}|{b}':v for (a,b),v in hit.items()},'pit':{f'{a}|{b}':v for (a,b),v in pit.items()}},open('data/merged.json','w'),ensure_ascii=False,indent=0)
print(len(hit),len(pit))
