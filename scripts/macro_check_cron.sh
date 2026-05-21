#!/bin/bash
# Economic Calendar Auto-Check + Telegram Push
# Runs every 15 minutes via Hermes cron
# Checks for newly released economic events, triggers NVIDIA AI analysis

cd /home/lemon/lemons-ai-agent

# Run check + analyze pipeline, capture output
OUTPUT=$(venv/bin/python3 scripts/economic_calendar.py --check --analyze-all 2>/tmp/macro_check.log)

# If there are analyzed events, output them (will be sent to Telegram)
if [ -n "$OUTPUT" ] && echo "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if len(d)>0 else 1)" 2>/dev/null; then
    echo "$OUTPUT" | venv/bin/python3 -c "
import sys, json
events = json.load(sys.stdin)
for evt in events:
    name = evt.get('event_name','?')
    flag = evt.get('surprise_flag','?')
    ai = evt.get('ai_impact',{})
    summary = ai.get('impact_summary','')
    tech = ai.get('impact_tech','')
    financial = ai.get('impact_financial','')
    broad = ai.get('impact_broad','')
    
    emoji = {'BEAT':'🟢','MISS':'🔴','INLINE':'⚪'}.get(flag,'⏳')
    actual = evt.get('actual_value','N/A')
    expected = evt.get('expected_value','N/A')
    
    print(f'{emoji} **{name}** {flag}')
    print(f'實際: {actual} | 預期: {expected}')
    if summary: print(f'\\n📋 {summary}')
    if tech: print(f'\\n💻 科技: {tech}')
    if financial: print(f'🏦 金融: {financial}')
    if broad: print(f'📊 大盤: {broad}')
    print()
" 2>/dev/null
fi
