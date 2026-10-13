#!/usr/bin/env python3
"""Read-only, bounded sitemap sample; emits its exact URL list and reproducible CSV.
Usage: python3 scripts/audit-public-seo.py --out audit/YYYY-MM-DD/seo --limit 160
An original URL list can be supplied with --urls (one URL per line).
"""
import argparse, csv, hashlib, json, time
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import xml.etree.ElementTree as ET

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title=[]; self.in_title=False; self.description=[]; self.canonical=[]
        self.mail=[]; self.protected_mail=[]; self.schemas=[]; self.jsonld=None
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='title': self.in_title=True
        if tag=='meta' and a.get('name','').lower()=='description': self.description.append(a.get('content',''))
        if tag=='link' and a.get('rel')=='canonical': self.canonical.append(a.get('href',''))
        if tag=='a':
            href=a.get('href','')
            if href.startswith('mailto:'): self.mail.append(href)
            if '/cdn-cgi/l/email-protection' in href: self.protected_mail.append(href)
        if tag=='script' and a.get('type')=='application/ld+json': self.jsonld=[]
    def handle_data(self, data):
        if self.in_title: self.title.append(data)
        if self.jsonld is not None: self.jsonld.append(data)
    def handle_endtag(self, tag):
        if tag=='title': self.in_title=False
        if tag=='script' and self.jsonld is not None:
            try: self.schemas.append(json.loads(''.join(self.jsonld)))
            except json.JSONDecodeError: self.schemas.append({'invalid_json':True})
            self.jsonld=None

def get(url):
    req=Request(url,headers={'User-Agent':'Alelm-Audit/2026-10-13 (read-only; bounded sample)'})
    try: response=urlopen(req,timeout=25)
    except HTTPError as error: response=error
    with response: return response.status,response.url,response.headers,response.read().decode('utf-8','replace')

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--limit',type=int,default=160);p.add_argument('--urls');args=p.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    if args.urls:
        urls=Path(args.urls).read_text().splitlines();source=args.urls;available=len(urls)
    else:
        source='https://alelm.net/sitemap.xml';status,_,_,xml=get(source)
        if status!=200: raise RuntimeError(f'sitemap status {status}')
        all_urls=[x.text for x in ET.fromstring(xml).iter() if x.tag.endswith('}loc')]
        available=len(all_urls)
        # Fixed first 60 plus evenly distributed archive pages; not the missing original 848.
        urls=list(dict.fromkeys(all_urls[:60]+[all_urls[round(i*(available-1)/max(1,args.limit-61))] for i in range(max(0,args.limit-60))]))[:args.limit]
    (out/'urls.txt').write_text('\n'.join(urls)+'\n')
    rows=[];schemas=[]
    started=datetime.now(timezone.utc).isoformat()
    for index,url in enumerate(urls):
        # Restrict supplied lists to this public origin, never accounts/API.
        if not url.startswith('https://alelm.net/') and url!='https://alelm.net': raise ValueError('URL outside public origin')
        if any(url.startswith('https://alelm.net/'+prefix) for prefix in ['api/','account','tahrir','join']): raise ValueError('Private path')
        try:
            status,final,headers,html=get(url);page=Page();page.feed(html)
            rows.append({'url':url,'status':status,'final_url':final,'title':''.join(page.title).strip(),'description':' | '.join(page.description),'description_count':len(page.description),'canonical':' | '.join(page.canonical),'canonical_count':len(page.canonical),'robots':headers.get('x-robots-tag',''),'mailto':' | '.join(page.mail),'protected_email_links':len(page.protected_mail),'html_sha256':hashlib.sha256(html.encode()).hexdigest()})
            schemas.append({'url':url,'data':page.schemas})
        except Exception as error: rows.append({'url':url,'status':'FETCH_ERROR','final_url':'','title':'','description':'','error':type(error).__name__})
        if index%20==0: print(index+1,len(urls),flush=True)
        time.sleep(.35)
    fields=list(dict.fromkeys(key for row in rows for key in row))
    with (out/'crawl.csv').open('w') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    good=[r for r in rows if r['status']==200]
    duplicates={k:{v:n for v,n in Counter(r[k] for r in good if r[k]).items() if n>1} for k in ['title','description','canonical']}
    examples=[r for r in good if any(r[k] in duplicates[k] or not r[k] for k in duplicates)]
    with (out/'duplicate-or-missing.csv').open('w') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(examples)
    summary={'started_utc':started,'ended_utc':datetime.now(timezone.utc).isoformat(),'source':source,'available_urls':available,'sample_size':len(urls),'successful_200':len(good),'status_counts':dict(Counter(str(r['status']) for r in rows)),'missing':{k:sum(not r[k] for r in good) for k in duplicates},'duplicate_groups':{k:len(v) for k,v in duplicates.items()},'duplicate_pages':{k:sum(v.values()) for k,v in duplicates.items()},'protected_email_links':sum(r.get('protected_email_links',0) for r in rows)}
    (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    (out/'structured-data.json').write_text(json.dumps(schemas,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__': main()
