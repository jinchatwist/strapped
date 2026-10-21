"""Turn data/watches.txt into data/catalog.json for the app."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
rows = []
for line in (root / "data/watches.txt").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    brand, family, model, ref, case, lug, thick, case_hex, dial_hex, strap, style, price = line.split("|")
    slug = re.sub(r"[^a-z0-9]+", "-", f"{model} {ref}".lower()).strip("-")
    rows.append(dict(
        id=slug, brand=brand, family=family, model=model, reference=ref,
        caseMm=float(case), lugMm=float(lug), thicknessMm=float(thick),
        caseHex=case_hex, dialHex=dial_hex, strap=strap,
        styles=style.split(","), priceUsd=int(price),
    ))
ids = [r["id"] for r in rows]
dupes = {i for i in ids if ids.count(i) > 1}
if dupes:
    raise SystemExit(f"Duplicate watches: {sorted(dupes)}")
(root / "data/catalog.json").write_text(json.dumps(rows, ensure_ascii=False, indent=0))
print(f"{len(rows)} watches written to data/catalog.json")
