#!/usr/bin/env python3
"""Independent listing-39 analysis. Standard-library Python 3.10+. No network.

python3 study.py --data data --out results
python3 collect.py --data live-data && python3 study.py --data live-data --out live-results
"""
import argparse
import bisect
import collections
import csv
import datetime as dt
import hashlib
import itertools
import json
import math
from pathlib import Path
from statistics import NormalDist

if not __debug__:
    raise RuntimeError('Run without -O: completeness assertions must remain enabled')

DAY = 86_400_000
START = 1786570412000  # 2026-08-12T21:33:32Z, listing's exact lower bound
CUTOFF = 1788134400000  # 2026-08-31T00:00:00Z
OBS = 1789344000000  # 2026-09-14T00:00:00Z
ARMS = ('door', 'sought', 'none')
PAIRS = tuple(itertools.combinations(ARMS, 2))


def ms(s):
    return round(dt.datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()*1000)


def utc(t):
    return dt.datetime.fromtimestamp(t/1000, dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False)+'\n')


def wilson(k, n, alpha=.05):
    if not n:
        return [None, None]
    if not 0 <= k <= n:
        raise ValueError('Invalid binomial counts')
    z = NormalDist().inv_cdf(1-alpha/2)
    p = k/n
    scale = 1+z*z/n
    centre = (p+z*z/(2*n))/scale
    half = z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/scale
    return [0. if k == 0 else max(0., centre-half), 1. if k == n else min(1., centre+half)]


def difference(k1, n1, k2, n2, alpha=.05):
    if not n1 or not n2:
        return {'difference': None, 'interval': [None, None]}
    p, q = k1/n1, k2/n2
    l1, u1 = wilson(k1, n1, alpha)
    l2, u2 = wilson(k2, n2, alpha)
    delta = p-q
    return {'difference': delta, 'interval': [max(-1., delta-math.hypot(p-l1, u2-q)), min(1., delta+math.hypot(u1-p, q-l2))]}


def gap(delays):
    values = sorted(set(d for d in delays if d is not None and d > 0))
    if len(values) < 2:
        raise ValueError('No identifiable positive delay gap')
    pairs = sorted(((b/a, a, b) for a, b in zip(values, values[1:])), key=lambda r: (-r[0], r[1]))
    ratio, a, b = pairs[0]
    return {'low_ms': a, 'high_ms': b, 'ratio': ratio, 'threshold_ms': math.sqrt(a*b),
            'unique_positive_delays': len(values), 'top_gaps': [{'low_ms': x, 'high_ms': y, 'ratio': r} for r, x, y in pairs[:10]]}


def classify(registered, bind, threshold, until=OBS):
    if bind is None or bind > until:
        return 'none'
    if bind < registered:
        raise ValueError('Negative bind delay')
    return 'door' if bind-registered < threshold else 'sought'


def in_outcome(timestamp, registered, start_day=7, end_day=14):
    return registered+start_day*DAY <= timestamp < registered+end_day*DAY


def summarize(rows, arm_key='arm', outcome_key='retained'):
    result = {'n': len(rows), 'arms': {}, 'differences': {}}
    for arm in ARMS:
        group = [r for r in rows if r[arm_key] == arm]
        k, n = sum(r[outcome_key] for r in group), len(group)
        result['arms'][arm] = {'n': n, 'retained': k, 'rate': k/n if n else None, 'interval': wilson(k, n)}
    for a, b in PAIRS:
        x, y = result['arms'][a], result['arms'][b]
        v = difference(x['retained'], x['n'], y['retained'], y['n'])
        v['familywise95_interval'] = difference(x['retained'], x['n'], y['retained'], y['n'], .05/3)['interval']
        result['differences'][a+'-'+b] = v
    return result


def check_pages(data):
    """Fail closed on lost pages, duplicate IDs, count mismatches or bad tokens."""
    records, checks = {}, {}
    for kind in ('citizens', 'events'):
        pages = json.loads((data/(kind+'.json')).read_text())
        assert pages and pages[0]['request']['since'] == 0
        rows, totals, expected = [], [], 0
        for i, page in enumerate(pages):
            req, d = page['request'], page['response']
            assert req == {'since': expected}, (kind, i, 'broken continuation')
            assert len(d[kind]) == d['returned' if kind == 'citizens' else 'count']
            if i < len(pages)-1:
                assert d['has_more'] is True
            totals.append(d['total'])
            rows.extend(d[kind])
            expected = d.get('next_since')
        assert pages[-1]['response']['has_more'] is False
        ids = [r['citizen_id' if kind == 'citizens' else 'id'] for r in rows]
        assert len(ids) == len(set(ids)) == totals[-1], (kind, len(ids), totals[-1])
        if kind == 'citizens':
            timestamps = [r['created_at'] for r in rows]
            assert timestamps == sorted(timestamps)
            extra = {'duplicate_registration_timestamps': len(timestamps)-len(set(timestamps)), 'cursor_type': 'timestamp'}
        else:
            assert ids == sorted(ids)
            assert set(ids) == set(range(1, max(ids)+1)), 'Identity ID gaps'
            counts = dict(collections.Counter(r['kind'] for r in rows))
            assert counts == pages[-1]['response']['totals_by_kind']
            extra = {'totals_by_kind': counts, 'latest_event_id': max(ids), 'cursor_type': 'id'}
        records[kind] = rows
        checks[kind] = {'pages': len(pages), 'rows': len(rows), 'unique_ids': len(set(ids)), 'first_total': totals[0], 'last_total': totals[-1], 'has_more_final': False, 'totals_changed': len(set(totals)) > 1, 'collection_start': pages[0]['started_at'], 'collection_end': pages[-1]['received_at'], **extra}

    pages = json.loads((data/'changes.json').read_text())
    initial = {'since': 0, 'posts_since': 'init', 'comments_since': 'init', 'nulls_since': 'done'}
    assert pages and pages[0]['request'] == initial
    first = pages[0]['response']
    caps = {s: int(first['next_'+s+'_since'].split(':')[1]) for s in ('posts', 'comments')}
    counts = {s: [] for s in caps}
    previous = None
    for i, page in enumerate(pages):
        req, d = page['request'], page['response']
        assert req['since'] == 0 and req['nulls_since'] == 'done'
        assert set(d['has_more_streams']) <= set(d['continuation_covers'])
        for s in caps:
            if previous is not None:
                old = previous['next_'+s+'_since']
                finished = old == 'done' or old.startswith('id:') or (old.startswith('snapi:') and int(old.split(':')[2]) >= caps[s])
                assert req[s+'_since'] == ('done' if finished else old), (i, s, 'token chain')
            assert len(d[s]) == d['rows_returned'][s]
            assert all(r['id'] <= caps[s] for r in d[s]), 'Snapshot ceiling overrun'
            assert all(isinstance(r.get('created_at'), int) and r.get('author') for r in d[s]), 'Missing attribution'
            counts[s].extend(d[s])
        previous = d
    assert pages[-1]['response']['has_more'] is False
    before = json.loads((data/'stats-before.json').read_text())
    after = json.loads((data/'stats-after.json').read_text())
    for s, rows in counts.items():
        ids = [r['id'] for r in rows]
        assert ids == sorted(ids) and len(ids) == len(set(ids))
        gaps = sorted(set(range(1, caps[s]+1))-set(ids))
        # All current holes are before the cohort's earliest outcome. New holes fail.
        assert gaps == ([2, 27] if s == 'posts' else [1, 2, 3]), (s, 'new unexplained gap', gaps)
        assert rows[-1]['id'] == caps[s]
        reported = [before['society'][s], after['society'][s]]
        reconciled = len(rows) in reported
        records[s] = rows
        checks[s] = {'pages_with_rows': sum(bool(p['response'][s]) for p in pages), 'rows': len(rows), 'unique_ids': len(set(ids)), 'snapshot_max_id': caps[s], 'gaps': gaps, 'stats_before': reported[0], 'stats_after': reported[1], 'matches_reported_total': reconciled, 'has_more_final': False, 'moderation_states': dict(collections.Counter(r.get('mod_state') or 'visible' for r in rows)), 'missing_attribution': 0}
    checks['changes'] = {'pages': len(pages), 'collection_start': pages[0]['started_at'], 'collection_end': pages[-1]['received_at'], 'has_more_final': False, 'mode': 'lossless ID snapshot, both streams initialized from zero', 'rows_are_metadata_projections': True}
    checks['all_totals_reconciled'] = all(checks[s]['matches_reported_total'] for s in caps)
    return records, checks


def analyze(data, out):
    assert START == ms('2026-08-12T21:33:32Z')
    assert CUTOFF == ms('2026-08-31T00:00:00Z') and OBS == CUTOFF+14*DAY
    rec, checks = check_pages(data)
    census = {r['citizen_id']: r for r in rec['citizens']}
    by_handle = {r['handle']: r for r in census.values()}
    assert len(by_handle) == len(census)
    binds, all_binds = {}, {}
    for e in rec['events']:
        if e['kind'] != 'key-bind':
            continue
        assert e['citizen_id'] in census, 'Unjoined key-bind event'
        cid, t = e['citizen_id'], e['created_at']
        all_binds[cid] = min(all_binds.get(cid, t), t)
        if t <= OBS:
            binds[cid] = min(binds.get(cid, t), t)
    checks['key_bind_join'] = {'rows': sum(e['kind']=='key-bind' for e in rec['events']), 'distinct_citizens_all_collected': len(all_binds), 'distinct_citizens_by_observation': len(binds), 'unjoined': 0}
    delays = [binds[cid]-c['created_at'] for cid, c in census.items() if START <= c['created_at'] <= OBS and cid in binds]
    assert all(d >= 0 for d in delays), 'Negative calibration delay'
    boundary = gap(delays)
    boundary['calibration_citizens'] = len(delays)
    boundary['zero_delays'] = delays.count(0)
    threshold = boundary['threshold_ms']
    writes = collections.defaultdict(list)
    unknown = []
    for typ in ('posts', 'comments'):
        for r in rec[typ]:
            if r['author'] not in by_handle:
                unknown.append({'type': typ, **r})
            writes[r['author']].append((r['created_at'], typ, r['id'], r.get('mod_state')))
    assert not unknown, 'Authored rows cannot join to census'
    for w in writes.values():
        w.sort()
    checks['writing_join_unmatched'] = len(unknown)

    def build(cutoff=CUTOFF, lower=START, split=threshold, final=OBS):
        rows = []
        for cid, c in census.items():
            a = c['created_at']
            if not lower <= a <= cutoff:
                continue
            b = binds.get(cid)
            hits = [w for w in writes[c['handle']] if in_outcome(w[0], a)]
            alternate = None if a+15*DAY > OBS else int(any(a+8*DAY <= w[0] < a+15*DAY for w in writes[c['handle']]))
            period = 'Aug 12-18' if a < ms('2026-08-19T00:00:00Z') else 'Aug 19-25' if a < ms('2026-08-26T00:00:00Z') else 'Aug 26-31'
            rows.append({'citizen_id': cid, 'handle': c['handle'], 'model': c['model'], 'registered_at': a, 'registered_utc': utc(a), 'bind_at': b, 'bind_delay_ms': None if b is None else b-a, 'arm': classify(a, b, split, final), 'arm_pre_window': classify(a, b, split, a+7*DAY-1), 'arm_end_window': classify(a, b, split, a+14*DAY-1), 'period': period, 'retained': int(bool(hits)), 'alternate_retained': alternate, 'post_hits': sum(w[1]=='posts' for w in hits), 'comment_hits': sum(w[1]=='comments' for w in hits), 'moderated_hits': sum(w[3] is not None for w in hits), 'first_hit_at': hits[0][0] if hits else None, 'first_hit_type': hits[0][1] if hits else None, 'first_hit_id': hits[0][2] if hits else None})
        return sorted(rows, key=lambda r: (r['registered_at'], r['citizen_id']))

    rows = build()
    primary = summarize(rows)
    cohort_gap = gap(r['bind_delay_ms'] for r in rows)
    sensitivity = {
        'pre_outcome_binding_status': summarize(rows, 'arm_pre_window'),
        'end_outcome_binding_status': summarize(rows, 'arm_end_window'),
        'cohort_only_boundary': {'boundary': cohort_gap, 'result': summarize(build(split=cohort_gap['threshold_ms']))},
        'registration_periods': {p: summarize([r for r in rows if r['period']==p]) for p in ('Aug 12-18', 'Aug 19-25', 'Aug 26-31')},
        'cutoffs': {s: summarize(build(cutoff=ms(s))) for s in ('2026-08-28T00:00:00Z', '2026-08-30T00:00:00Z')},
        'alternate_days_8_to_15': summarize([r for r in rows if r['alternate_retained'] is not None], outcome_key='alternate_retained'),
        'alternate_days_excluded_without_15day_followup': sum(r['alternate_retained'] is None for r in rows),
        'replicate_prior_windows': {s: summarize(build(cutoff=ms(s))) for s in ('2026-08-31T00:30:00Z', '2026-08-31T04:46:28.333Z')},
        'prior_window_comparison_note': 'Expanded-window comparisons use writing observed at collection, whose first changes page is after every included 14-day endpoint; they are not the primary midnight-observation cohort. Bind classification is still frozen at primary observation; no primary cohort citizen changed binding arm between observation and collection.',
    }
    timing = {}
    for arm in ARMS:
        group = [r for r in rows if r['arm']==arm]
        timing[arm] = {'n': len(group), 'bind_during_window': sum(r['bind_at'] is not None and r['registered_at']+7*DAY <= r['bind_at'] < r['registered_at']+14*DAY for r in group), 'bind_at_or_after_window_end': sum(r['bind_at'] is not None and r['bind_at'] >= r['registered_at']+14*DAY for r in group), 'bind_after_first_retained_write': sum(r['bind_at'] is not None and r['first_hit_at'] is not None and r['bind_at'] > r['first_hit_at'] for r in group)}
    transitions = collections.Counter((r['arm'], r['arm_pre_window']) for r in rows)
    timing['pre_window_transitions'] = [{'snapshot': a, 'pre_window': b, 'n': n} for (a, b), n in sorted(transitions.items())]
    falsifier = {}
    for pair, v in primary['differences'].items():
        lo, hi = v['interval']
        p = sensitivity['pre_outcome_binding_status']['differences'][pair]
        directional = lo > 0 or hi < 0
        same_sign = v['difference']*p['difference'] > 0
        falsifier[pair] = {'pointwise_direction_resolved': directional, 'pre_window_same_sign': same_sign, 'pre_specified_direction_rule_met': directional and same_sign, 'familywise_direction_resolved': v['familywise95_interval'][0]>0 or v['familywise95_interval'][1]<0}
    checks['cohort'] = {'n': len(rows), 'retained': sum(r['retained'] for r in rows), 'unbound_by_observation': sum(r['arm']=='none' for r in rows), 'negative_delay_count': sum(r['bind_delay_ms'] is not None and r['bind_delay_ms']<0 for r in rows), 'retained_only_by_moderated_rows': sum(r['retained'] and r['moderated_hits']==r['post_hits']+r['comment_hits'] for r in rows), 'citizens_with_writes_before_registration': sum(any(w[0]<r['registered_at'] for w in writes[r['handle']]) for r in rows), 'outcome_window_end_max': utc(max(r['registered_at'] for r in rows)+14*DAY)}
    checks['early_boundary_citizens'] = [c for c in census.values() if START-1000 <= c['created_at'] < START+1000]
    checks['gap_witnesses'] = [{'citizen_id': cid, 'handle': c['handle'], 'registration_utc': utc(c['created_at']), 'delay_ms': binds[cid]-c['created_at'], 'in_primary_cohort': START <= c['created_at'] <= CUTOFF} for cid, c in census.items() if cid in binds and binds[cid]-c['created_at'] in {boundary['low_ms'], boundary['high_ms'], cohort_gap['low_ms'], cohort_gap['high_ms']}]
    # Compare all-collected vs timestamp-frozen classification without changing primary.
    snapshot_changed = []
    for r in rows:
        current = classify(r['registered_at'], all_binds.get(r['citizen_id']), threshold, float('inf'))
        if current != r['arm']:
            snapshot_changed.append({'citizen_id': r['citizen_id'], 'frozen': r['arm'], 'collected': current})
    checks['cohort_bind_changes_after_observation'] = snapshot_changed
    input_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(data.glob('*.json'))}
    result = {'population_start': utc(START), 'population_cutoff': utc(CUTOFF), 'observation': utc(OBS), 'boundary': boundary, 'primary': primary, 'timing': timing, 'falsifier': falsifier, 'sensitivity': sensitivity, 'input_hashes': input_hashes}
    dump(out/'results.json', result)
    dump(out/'completeness.json', checks)
    out.mkdir(parents=True, exist_ok=True)
    with (out/'cohort.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    md = ['# Calculated results', '', f'Population: {utc(START)} to {utc(CUTOFF)}, inclusive. Observation: {utc(OBS)}.', '', '| Arm | n | Retained | Rate | 95% Wilson interval |', '|---|---:|---:|---:|---:|']
    for a, r in primary['arms'].items():
        md.append(f"| {a} | {r['n']} | {r['retained']} | {100*r['rate']:.2f}% | {100*r['interval'][0]:.2f}% to {100*r['interval'][1]:.2f}% |")
    md += ['', '| Difference | Percentage points | 95% Newcombe interval | Familywise 95% interval |', '|---|---:|---:|---:|']
    for pair, r in primary['differences'].items():
        md.append(f"| {pair} | {100*r['difference']:+.2f} | {100*r['interval'][0]:+.2f} to {100*r['interval'][1]:+.2f} | {100*r['familywise95_interval'][0]:+.2f} to {100*r['familywise95_interval'][1]:+.2f} |")
    md += ['', 'All intervals are descriptive independent-binomial model intervals. Association only; no causal or equivalence claim.', '']
    (out/'TABLES.md').write_text('\n'.join(md))
    print('\n'.join(md))
    print('Boundary:', json.dumps(boundary))
    print('Completeness:', checks['all_totals_reconciled'], 'Timing:', json.dumps(timing))
    return result, checks


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--data', type=Path, default=Path('data'))
    p.add_argument('--out', type=Path, default=Path('results'))
    a = p.parse_args()
    analyze(a.data, a.out)
