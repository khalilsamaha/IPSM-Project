"""Independent Poppler parser/raster checks for synthetic review PDFs only.
Usage: python3 tools/receipts/verify-samples.py /tmp/ipsm-receipt-v4-review
Requires pdfinfo, pdftotext and pdftoppm. Does not read environment credentials.
"""
import json
import pathlib
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

root = pathlib.Path(sys.argv[1])
reports = []
for pdf in sorted(root.glob('v4-*.pdf')):
    info = subprocess.check_output(['pdfinfo', str(pdf)], text=True)
    count = int(re.search(r'Pages:\s+(\d+)', info)[1])
    xml = subprocess.check_output(['pdftotext', '-bbox', str(pdf), '-'], text=True)
    pages = ET.fromstring(xml).findall('.//{*}page')
    assert len(pages) == count
    for index, page in enumerate(pages):
        width, height = float(page.attrib['width']), float(page.attrib['height'])
        assert abs(width - 148 * 72 / 25.4) < .01 and abs(height - 210 * 72 / 25.4) < .01
        words = page.findall('.//{*}word')
        boxes = [tuple(float(word.attrib[key]) for key in ['xMin', 'yMin', 'xMax', 'yMax']) for word in words]
        for left, top, right, bottom in boxes:
            assert left >= 23 and right <= width - 23 and top >= 23 and bottom <= height - 10, (pdf.name, index, 'text outside margins')
        for i, a in enumerate(boxes):
            for b in boxes[i + 1:]:
                assert min(a[2], b[2]) - max(a[0], b[0]) < .2 or min(a[3], b[3]) - max(a[1], b[1]) < .2, (pdf.name, index, 'overlapping text')
    subprocess.run(['pdftoppm', '-scale-to', '1100', '-png', str(pdf), str(pdf.with_suffix(''))], check=True, capture_output=True)
    reports.append({'file': pdf.name, 'pages': count, 'a5_all_pages': True, 'text_bounds_and_overlap': 'PASS'})
assert reports, 'No synthetic V4 PDFs found'
(root / 'verification.json').write_text(json.dumps(reports, indent=2) + '\n')
print(json.dumps(reports, indent=2))
