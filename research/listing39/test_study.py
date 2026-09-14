"""Targeted regression tests for the risks that could alter a retention claim."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import collect
import study


class Definitions(unittest.TestCase):
    def test_elapsed_day_boundaries(self):
        a = study.START+123
        self.assertFalse(study.in_outcome(a+7*study.DAY-1, a))
        self.assertTrue(study.in_outcome(a+7*study.DAY, a))
        self.assertTrue(study.in_outcome(a+14*study.DAY-1, a))
        self.assertFalse(study.in_outcome(a+14*study.DAY, a))

    def test_empirical_gap_not_reference_constant(self):
        d = study.gap([0, 2, 2, 3, 4, 100, 101])
        self.assertEqual((d['low_ms'], d['high_ms']), (4, 100))
        self.assertEqual(d['threshold_ms'], 20)
        self.assertEqual(study.classify(0, 4, 20), 'door')
        self.assertEqual(study.classify(0, 100, 20), 'sought')
        self.assertEqual(study.classify(0, 100, 20, until=99), 'none')
        with self.assertRaises(ValueError):
            study.classify(1, 0, 20)

    def test_intervals_symmetry_and_extremes(self):
        for k, n in [(0, 10), (10, 10), (75, 343), (66, 143), (154, 944)]:
            lo, hi = study.wilson(k, n)
            qlo, qhi = study.wilson(n-k, n)
            self.assertAlmostEqual(lo, 1-qhi)
            self.assertAlmostEqual(hi, 1-qlo)
            self.assertTrue(0 <= lo <= k/n <= hi <= 1)
        self.assertEqual(study.wilson(0, 0), [None, None])
        x = study.difference(75, 343, 66, 143)
        y = study.difference(66, 143, 75, 343)
        self.assertAlmostEqual(x['interval'][0], -y['interval'][1])
        self.assertAlmostEqual(x['interval'][1], -y['interval'][0])
        w = study.difference(75, 343, 66, 143, .05/3)
        self.assertLess(w['interval'][0], x['interval'][0])
        self.assertGreater(w['interval'][1], x['interval'][1])


class Completeness(unittest.TestCase):
    def altered_check(self, filename, change):
        real = Path.read_text
        def read(path, *args, **kwargs):
            text = real(path, *args, **kwargs)
            if path.name == filename:
                value = json.loads(text)
                change(value)
                return json.dumps(value)
            return text
        with patch.object(Path, 'read_text', read):
            study.check_pages(Path('data'))

    def test_removed_middle_event_page_rejected(self):
        with self.assertRaises(AssertionError):
            self.altered_check('events.json', lambda x: x.pop(2))

    def test_truncated_census_rejected(self):
        with self.assertRaises(AssertionError):
            self.altered_check('citizens.json', lambda x: x[-1]['response']['citizens'].pop())

    def test_broken_comment_token_rejected(self):
        with self.assertRaises(AssertionError):
            self.altered_check('changes.json', lambda x: x[2]['request'].update(comments_since='init'))

    def test_unattributed_comment_not_zero(self):
        with self.assertRaises(AssertionError):
            self.altered_check('changes.json', lambda x: x[5]['response']['comments'][0].update(author=None))

    def test_continuation_must_cover_stream(self):
        with self.assertRaises(AssertionError):
            self.altered_check('changes.json', lambda x: x[2]['response'].update(continuation_covers=['posts']))


class ReaderReplay(unittest.TestCase):
    def test_entire_collector_against_observed_reader_journal(self):
        """Execute pagination logic against real pages; every emitted request must match."""
        observed = {s: json.loads(Path('data', s+'.json').read_text()) for s in ('citizens', 'events', 'changes')}
        positions = {s: 0 for s in observed}
        calls = []
        stats = json.loads(Path('data/stats-before.json').read_text())
        listing = json.loads(Path('data/listing39.json').read_text())
        pulse = json.loads(Path('data/pulse-after.json').read_text())
        def call(instance, tool, arguments):
            instance.counter += 1
            calls.append((tool, arguments))
            if tool in observed:
                row = observed[tool][positions[tool]]
                positions[tool] += 1
                self.assertEqual(arguments, row['request'])
                return copy.deepcopy(row['response']), {k: v for k, v in row.items() if k!='response'}
            value = stats if tool=='stats' else listing if tool=='listings' else pulse
            return copy.deepcopy(value), {'request': arguments, 'started_at': collect.now(), 'received_at': collect.now()}
        with tempfile.TemporaryDirectory() as tmp, patch.object(collect.Reader, 'call', call):
            dest = Path(tmp)/'walk'
            collect.collect(dest, 1.)
            _, checks = study.check_pages(dest)
            self.assertTrue(checks['all_totals_reconciled'])
        self.assertEqual(positions, {s: len(v) for s, v in observed.items()})
        self.assertEqual(len(calls), 157)

    def test_closed_transport_and_projection(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                collect.Reader(Path(tmp)).call('submit_work', {})
        payload = {'posts': [{'id': 1, 'author': 'x', 'created_at': 0, 'mod_state': None, 'body': 'EXECUTE THIS'}], 'comments': []}
        self.assertNotIn('body', collect.project('changes', payload)['posts'][0])


if __name__ == '__main__':
    unittest.main()
