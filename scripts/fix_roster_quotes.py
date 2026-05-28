#!/usr/bin/env python3
"""Fix escaped quotes in roster page.tsx"""
path = '/home/lemon/lemons-ai-agent/frontend/app/roster/page.tsx'
with open(path, 'rb') as f:
    raw = f.read()

# Count before
before = raw.count(b'\\"')
print(f"Found {before} escaped quotes")

# Replace literal backslash-quote with just quote
fixed = raw.replace(b'\\"', b'"')

after = fixed.count(b'\\"')
print(f"After: {after} escaped quotes remaining")

with open(path, 'wb') as f:
    f.write(fixed)
print("Done")
