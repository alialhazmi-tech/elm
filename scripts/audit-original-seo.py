#!/usr/bin/env python3
"""Recheck an original Page URL CSV with bounded public GETs and redirect evidence."""
import argparse
import csv
import hashlib
import importlib.util
import json
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('public_seo', Path(__file__).with_name('audit-public-seo.py'))
public_seo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(public_seo)


def public_url(value):
    parts = urlsplit(value)
    if parts.scheme != 'https' or parts.netloc != 'alelm.net':
        raise ValueError('URL outside public origin')
    path = unquote(parts.path)
    if any(path == '/' + prefix or path.startswith('/' + prefix + '/')
           for prefix in ('api', 'account', 'tahrir', 'join')):
        raise ValueError('Private path')
    return urlunsplit((parts.scheme, parts.netloc, quote(parts.path, safe='/%:@-._~'),
                      quote(parts.query, safe='=&%:+,/?@-._~'), ''))


class Redirects(HTTPRedirectHandler):
    def __init__(self):
        self.chain = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = public_url(newurl)
        self.chain.append({'status': code, 'from': req.full_url, 'to': target})
        return super().redirect_request(req, fp, code, msg, headers, target)


def check(url):
    redirects = Redirects()
    row = {'url': url, 'initial_status': '', 'final_status': '', 'final_url': '',
           'redirect_count': 0, 'title': '', 'description': '', 'canonical': '',
           'description_count': 0, 'canonical_count': 0, 'protected_email_links': 0,
           'html_sha256': '', 'error': '', 'redirects': ''}
    try:
        request = Request(public_url(url), headers={'User-Agent': 'Alelm-Audit/2026-10-13 (original-list verification)'})
        try:
            response = build_opener(redirects).open(request, timeout=30)
        except HTTPError as error:
            response = error
        with response:
            html = response.read().decode('utf-8', 'replace')
            page = public_seo.Page()
            page.feed(html)
            row.update(initial_status=redirects.chain[0]['status'] if redirects.chain else response.status,
                       final_status=response.status, final_url=unquote(response.url),
                       title=''.join(page.title).strip(), description=' | '.join(page.description),
                       canonical=' | '.join(page.canonical), description_count=len(page.description),
                       canonical_count=len(page.canonical), protected_email_links=len(page.protected_mail),
                       html_sha256=hashlib.sha256(html.encode()).hexdigest())
    except Exception as error:
        row['error'] = type(error).__name__
    row['redirect_count'] = len(redirects.chain)
    row['redirects'] = json.dumps(redirects.chain, ensure_ascii=False)
    time.sleep(0.35)
    return row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    source = Path(args.csv)
    records = list(csv.DictReader(source.open(encoding='utf-8-sig')))
    urls = list(dict.fromkeys(row['Page URL'] for row in records))
    for url in urls:
        public_url(url)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'urls.txt').write_text('\n'.join(urls) + '\n')
    started = datetime.now(timezone.utc).isoformat()
    results = {}
    with (out / 'progress.jsonl').open('w') as progress, ThreadPoolExecutor(max_workers=2) as executor:
        jobs = {executor.submit(check, url): url for url in urls}
        for job in as_completed(jobs):
            row = job.result()
            results[row['url']] = row
            progress.write(json.dumps(row, ensure_ascii=False) + '\n')
            progress.flush()
            if len(results) % 50 == 0:
                print(f'{len(results)}/{len(urls)}', flush=True)
    rows = [results[url] for url in urls]
    direct = [row for row in rows if row['initial_status'] == 200 and not row['error']]
    fields = ('title', 'description', 'canonical')
    duplicates = {key: {value: count for value, count in Counter(row[key] for row in direct if row[key]).items()
                        if count > 1} for key in fields}
    examples = [row for row in direct if any(not row[key] or row[key] in duplicates[key] for key in fields)]
    for name, values in [('crawl.csv', rows), ('duplicate-or-missing.csv', examples),
                         ('redirects-or-errors.csv', [row for row in rows if row['initial_status'] != 200 or row['error']])]:
        with (out / name).open('w') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(values)
    summary = {'started_utc': started, 'ended_utc': datetime.now(timezone.utc).isoformat(),
               'source_csv_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
               'source_records': len(records), 'unique_requested_urls': len(urls),
               'initial_status_counts': dict(Counter(str(row['initial_status']) for row in rows)),
               'final_status_counts': dict(Counter(str(row['final_status']) for row in rows)),
               'fetch_errors': sum(bool(row['error']) for row in rows),
               'direct_200_pages': len(direct),
               'missing': {key: sum(not row[key] for row in direct) for key in fields},
               'duplicate_groups': {key: len(value) for key, value in duplicates.items()},
               'duplicate_pages': {key: sum(value.values()) for key, value in duplicates.items()},
               'protected_email_links': sum(row['protected_email_links'] for row in rows),
               'method': 'Exact extracted values; duplicate/missing counts use direct HTTP 200 pages only. Redirects and errors are reported separately.'}
    (out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    (out / 'progress.jsonl').unlink()
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
