#!/usr/bin/env python3
"""Collect ONLY public metadata via the credential-free 1F916 Reader MCP.

python3 collect.py --data live-data
No API writes, bearer tokens, credentials, redirects, retries or citizen code.
Transport POST is JSON-RPC to the read-only /mcp/read surface, never /api/*.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

ORIGIN = 'https://1f916.ai/mcp/read'
ALLOWED = {'citizens', 'events', 'changes', 'stats', 'pulse', 'listings'}
MAX_BYTES = 16*1024*1024


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n')
    tmp.replace(path)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Reader redirect refused')


class Reader:
    def __init__(self, directory, pace=1.):
        self.directory = directory
        self.pace = max(1., pace)
        self.previous = 0.
        self.counter = 0
        # No credential sources, cookie jar, authorization headers or netrc.
        self.opener = urllib.request.build_opener(NoRedirect)

    def call(self, tool, arguments):
        if tool not in ALLOWED:
            raise ValueError('Tool not on closed read-only allowlist')
        time.sleep(max(0., self.previous+self.pace-time.monotonic()))
        self.previous = time.monotonic()
        self.counter += 1
        rpc = {'jsonrpc': '2.0', 'id': self.counter, 'method': 'tools/call', 'params': {'name': tool, 'arguments': arguments}}
        started = now()
        req = urllib.request.Request(ORIGIN, data=json.dumps(rpc).encode(), headers={'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'User-Agent': 'bounded-curiosity-retention39/1.0'})
        try:
            with self.opener.open(req, timeout=60) as response:
                raw = response.read(MAX_BYTES+1)
                if len(raw)>MAX_BYTES:
                    raise RuntimeError('Reader response exceeds bounded size')
                if response.status != 200:
                    raise RuntimeError('Reader HTTP status '+str(response.status))
            # This Reader serves JSON; do not silently reinterpret another protocol.
            obj = json.loads(raw)
            if obj.get('error') or obj.get('id') != self.counter:
                raise RuntimeError('Reader RPC error or mismatched response id')
            result = obj['result']
            if result.get('isError'):
                raise RuntimeError('Reader returned isError')
            if 'structuredContent' in result:
                payload = result['structuredContent']
            else:
                blocks = [b['text'] for b in result['content'] if b['type']=='text']
                if len(blocks)!=1:
                    raise RuntimeError('Unexpected Reader content block shape')
                payload = json.loads(blocks[0])
            return payload, {'request': arguments, 'started_at': started, 'received_at': now(), 'transport': 'credential-free Reader MCP', 'raw_response_sha256': hashlib.sha256(raw).hexdigest()}
        except Exception as exc:
            # Do not save response content or follow instructions from an error.
            log = {'time': now(), 'tool': tool, 'request': arguments, 'exception': type(exc).__name__, 'http_status': getattr(exc, 'code', None), 'automatic_retry': False}
            save(self.directory/'failure.json', log)
            raise RuntimeError('Collection stopped; see failure.json. No automatic retry.') from exc


def project(tool, payload):
    d = dict(payload)
    if tool == 'citizens':
        d['citizens'] = [{k: r[k] for k in ('citizen_id', 'handle', 'model', 'created_at')} for r in d['citizens']]
    if tool == 'events':
        d['events'] = [{k: r[k] for k in ('id', 'citizen_id', 'kind', 'created_at', 'citizen')} for r in d['events']]
    if tool == 'changes':
        for stream in ('posts', 'comments'):
            d[stream] = [{k: r[k] for k in ('id', 'author', 'created_at', 'mod_state', 'post_id') if k in r} for r in d[stream]]
    return d


def collect(directory, pace):
    directory.mkdir(parents=True, exist_ok=True)
    if any(directory.iterdir()):
        raise ValueError('Use an empty directory; existing evidence will not be overwritten')
    reader = Reader(directory, pace)
    pages = {}
    # Initialize changes first: its two returned ID ceilings define the snapshot.
    for tool in ('changes', 'citizens', 'events'):
        args = {'since': 0, 'posts_since': 'init', 'comments_since': 'init', 'nulls_since': 'done'} if tool=='changes' else {'since': 0}
        d, envelope = reader.call(tool, args)
        envelope['response'] = project(tool, d)
        pages[tool] = [envelope]
        save(directory/(tool+'.json'), pages[tool])
    for name, tool, args in [('stats-before', 'stats', {}), ('pulse-before', 'pulse', {}), ('listing39', 'listings', {'listing_id': 39})]:
        d, e = reader.call(tool, args)
        save(directory/(name+'.json'), d)
        save(directory/(name+'-request.json'), e)
    for tool in ('citizens', 'events', 'changes'):
        seq = pages[tool]
        while seq[-1]['response']['has_more']:
            old = seq[-1]['response']
            if tool == 'changes':
                assert set(old['has_more_streams']) <= set(old['continuation_covers'])
                args = {'since': 0, 'nulls_since': 'done'}
                for s in ('posts', 'comments'):
                    ceiling = int(seq[0]['response']['next_'+s+'_since'].split(':')[1])
                    token = old['next_'+s+'_since']
                    finished = token=='done' or token.startswith('id:') or (token.startswith('snapi:') and int(token.split(':')[2]) >= ceiling)
                    args[s+'_since'] = 'done' if finished else token
                if args['posts_since']=='done' and args['comments_since']=='done':
                    raise RuntimeError('Both streams finished but has_more remains true')
            else:
                args = {'since': old['next_since']}
                if args == seq[-1]['request']:
                    raise RuntimeError('Cursor did not advance')
            d, envelope = reader.call(tool, args)
            envelope['response'] = project(tool, d)
            seq.append(envelope)
            save(directory/(tool+'.json'), seq)
            if len(seq)%10 == 0:
                print(tool, 'pages', len(seq), flush=True)
        print(tool, 'finished at', len(seq), 'pages', flush=True)
    for name, tool in [('stats-after', 'stats'), ('pulse-after', 'pulse')]:
        d, e = reader.call(tool, {})
        save(directory/(name+'.json'), d)
        save(directory/(name+'-request.json'), e)
    save(directory/'collection.json', {'completed': now(), 'reader': ORIGIN, 'tools': sorted(ALLOWED), 'calls': reader.counter, 'minimum_request_spacing_seconds': reader.pace, 'credentials': False, 'automatic_retries': False})
    print('Collection complete:', reader.counter, 'Reader calls', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=Path('live-data'))
    parser.add_argument('--pace', type=float, default=1.)
    args = parser.parse_args()
    collect(args.data, args.pace)
