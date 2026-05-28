"""Display 30-day schedule in readable format."""
import json, sys
from collections import defaultdict

filepath = sys.argv[1] if len(sys.argv) > 1 else '/tmp/schedule_result.json'
with open(filepath) as f:
    d = json.load(f)

print(f"\n{'='*60}")
print(f"  Solver Result: {d['status']}")
print(f"  Shifts: {d['stats']['total_shifts']} | Staff: {d['stats']['staff_count']}")
print(f"  Days: {d['stats']['day_count']} | Time: {d['stats']['solve_time_ms']}ms")
print(f"  Penalty: {d['stats']['objective_value']}")
print(f"  Warnings: {len(d['warnings'])}")
for w in d['warnings'][:8]:
    print(f"    ⚠ {w}")
print(f"{'='*60}")

# Staff workload summary
workload = defaultdict(lambda: {"total": 0, "nights": 0, "weekends": 0, "shifts": set()})
for a in d['assignments']:
    wl = workload[a['staff_name']]
    wl['total'] += 1
    wl['shifts'].add(a['shift_code'])
    if a['shift_code'] == 'N':
        wl['nights'] += 1
    dt = a['date']
    dow = (int(dt[8:10]) + 3) % 7  # rough, good enough for demo
    if dow >= 5:
        wl['weekends'] += 1

print(f"\n📊 工時統計:")
print(f"{'職員':<10} {'總更':>4} {'夜更':>4} {'週末':>4} {'更份':>12}")
print("-" * 40)
for name in sorted(workload.keys()):
    wl = workload[name]
    print(f"{name:<10} {wl['total']:>4} {wl['nights']:>4} {wl['weekends']:>4} {','.join(sorted(wl['shifts'])):>12}")

# Unit-day coverage check
coverage = defaultdict(lambda: defaultdict(int))
for a in d['assignments']:
    coverage[a['unit']][a['shift_code']] += 1

print(f"\n📋 每家社總更次:")
for unit in ['A','B','C','D','E']:
    day_shifts = coverage[unit].get('1423', 0)
    night_shifts = coverage[unit].get('N', 0)
    total = sum(coverage[unit].values())
    print(f"  {unit}社: {total} total ({day_shifts} day + {night_shifts} night)")

# Weekly snapshot: first 7 days
print(f"\n📅 第一週排更:")
print(f"{'Date':<12} {'A社':<30} {'B社':<30} {'C社':<30}")
print("-" * 102)
grid = defaultdict(lambda: defaultdict(list))
for a in d['assignments']:
    grid[a['date']][a['unit']].append(f"{a['staff_name']}({a['shift_code']})")
for date in sorted(grid.keys())[:7]:
    print(f"{date:<12}", end="")
    for unit in ['A','B','C']:
        entries = ', '.join(grid[date].get(unit, ['—']))
        print(f" {entries:<30}", end="")
    print()
for date in sorted(grid.keys())[7:14]:
    print(f"{date:<12}", end="")
    for unit in ['D','E']:
        entries = ', '.join(grid[date].get(unit, ['—']))
        print(f" {entries:<30}", end="")
    print()
