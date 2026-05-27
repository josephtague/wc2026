#!/usr/bin/env python3
"""
convert-schedule.py
Reads data/World_Cup_2026_Schedule.xlsx and writes public/data/matches.json.
Run from the project root: python3 scripts/convert-schedule.py
"""
import json, sys, os
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl not found. Run: pip3 install openpyxl")

ROOT   = Path(__file__).parent.parent
SRC    = ROOT / "data" / "World_Cup_2026_Schedule.xlsx"
DEST   = ROOT / "public" / "data" / "matches.json"

if not SRC.exists():
    sys.exit(f"Source not found: {SRC}")

wb = openpyxl.load_workbook(SRC)
ws = wb.active

# Column mapping (0-indexed after skipping header)
# Match#  Stage  Group/Match  Fixture  Venue
# LA-Day LA-Time  NY-Day NY-Time  SAO-Day SAO-Time  BUE-Day BUE-Time
# LDN-Day LDN-Time  PAR-Day PAR-Time  MUM-Day MUM-Time  SYD-Day SYD-Time

matches = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0] is None:
        continue
    (num, stage, group, fixture, venue,
     laDay, laTime, nyDay, nyTime,
     saoDay, saoTime, bueDay, bueTime,
     ldnDay, ldnTime, parDay, parTime,
     mumDay, mumTime, sydDay, sydTime) = row

    # Normalise time values — openpyxl may return them as strings or datetime.time
    def fmt(t):
        if t is None: return ""
        if hasattr(t, 'strftime'):  # datetime.time object
            h, m = t.hour, t.minute
            suffix = "am" if h < 12 else "pm"
            h12 = h % 12 or 12
            return f"{h12}:{m:02d} {suffix}"
        return str(t).strip()

    matches.append({
        "num":     int(num),
        "stage":   str(stage),
        "group":   str(group) if group else "",
        "fixture": str(fixture),
        "venue":   str(venue),
        # Los Angeles (PT)
        "ptDay":  str(laDay),  "ptTime":  fmt(laTime),
        # New York (ET)
        "etDay":  str(nyDay),  "etTime":  fmt(nyTime),
        # São Paulo (BRT)
        "brtDay": str(saoDay), "brtTime": fmt(saoTime),
        # Buenos Aires (ART)
        "artDay": str(bueDay), "artTime": fmt(bueTime),
        # London (BST) — reference column used to derive UTC
        "bstDay": str(ldnDay), "bstTime": fmt(ldnTime),
        # Madrid / Paris (CEST)
        "cestDay": str(parDay), "cestTime": fmt(parTime),
        # Mumbai (IST)
        "istDay": str(mumDay), "istTime": fmt(mumTime),
        # Sydney (AEST)
        "aestDay": str(sydDay), "aestTime": fmt(sydTime),
    })

DEST.parent.mkdir(parents=True, exist_ok=True)
DEST.write_text(json.dumps(matches, ensure_ascii=False, indent=2))
print(f"✓ Wrote {len(matches)} matches → {DEST.relative_to(ROOT)}")
