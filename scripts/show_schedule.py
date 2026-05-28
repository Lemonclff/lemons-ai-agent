"""Display a schedule JSON file in readable grid format."""
import json, sys

filepath = sys.argv[1] if len(sys.argv) > 1 else '/tmp/schedule_result.json'
with open(filepath) as f:
    d = json.load(f)

print(f"Status: {d['status']}")
print(f"Shifts: {d['stats']['total_shifts']} | Staff: {d['stats']['staff_count']} | Days: {d['stats']['day_count']} | Time: {d['stats']['solve_time_ms']}ms | Penalty: {d['stats']['objective_value']}")
print(f"Warnings: {len(d['warnings'])}")
for w in d['warnings'][:10]:
    print(f"  ⚠ {w}")
print()

# Grid view
grid = {}
for a in d['assignments']:
    key = (a['date'], a['unit'])
    grid.setdefault(key, []).append(f"{a['staff_name']}({a['shift_code']})")

print(f"{'Date':<12}", end="")
for unit in ['A','B','C','D','E']:
    print(f"{unit}社                    ", end=" ")
print()
print("-" * 120)

for date in sorted(set(a['date'] for a in d['assignments'])):
    print(f"{date:<12}", end="")
    for unit in ['A','B','C','D','E']:
        entries = grid.get((date, unit), ['—'])
        cell = ', '.join(entries)
        print(f"{cell:<25}", end=" ")
    print()
