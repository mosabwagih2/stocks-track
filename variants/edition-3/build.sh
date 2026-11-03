#!/bin/sh
# Rebuilds apps/edition-3 (original + changes) and apps/edition-3-brand from base.html.
set -e
cd "$(dirname "$0")"
python3 1_state.py && python3 1b_rates.py && python3 2_returns_sheet.py && python3 3_toggle.py && python3 4_brand.py
