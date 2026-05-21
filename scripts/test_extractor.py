#!/usr/bin/env python3
"""Test _extract_json_array with various problematic inputs"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from finance_backend import _extract_json_array

tests = [
    ('normal', '[{"a":1},{"b":2}]'),
    ('fenced', '```json\n[{"a":1}]\n```'),
    ('fenced_no_lang', '```\n[{"a":1}]\n```'),
    ('fence_space', '``` json\n[{"a":1}]\n```'),
    ('reasoning', 'Here is analysis:\n\n[{"date":"2026-05-01","amount":45}]\n\nDone.'),
    ('trailing_comma', '[{"a":1},]'),
    ('trailing_comma2', '[{"a":1,"b":2,},]'),
    ('empty', ''),
    ('whitespace', '   \n  '),
    ('truncated_mid', '[{"a":1},{"b":'),
    ('truncated_end_comma', '[{"a":1},{"b":2},'),
    ('truncated_string', '[{"desc":"unfinishe'),
    ('just_text', 'No JSON here at all.'),
]

for name, input_text in tests:
    result = _extract_json_array(input_text)
    status = "OK" if result is not None else "FAIL"
    preview = str(result)[:80] if result else "None"
    print(f"  [{status}] {name:25s} → {preview}")
