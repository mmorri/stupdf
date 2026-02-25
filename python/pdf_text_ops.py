#!/usr/bin/env python3
"""PDF text extraction and editing via PyMuPDF (fitz).

Reads a JSON command from stdin, writes a JSON result to stdout.
Commands:
  extract      - Extract all text spans with metadata
  apply_edits  - Redact old text and reinsert new text
"""

import sys
import json
import fitz  # PyMuPDF


def rgb_to_hex(r, g, b):
    """Convert 0-1 float RGB to hex string."""
    return "#{:02x}{:02x}{:02x}".format(
        int(round(r * 255)), int(round(g * 255)), int(round(b * 255))
    )


def hex_to_rgb01(hex_str):
    """Convert hex color string to (r, g, b) floats in 0-1 range."""
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)


def map_fontname(font_name):
    """Map PDF font name to a fitz built-in fontname."""
    lower = font_name.lower()
    if "times" in lower:
        return "times"
    if "courier" in lower or "mono" in lower:
        return "cour"
    return "helv"


def extract_text(file_path):
    """Extract all text spans from every page."""
    doc = fitz.open(file_path)
    pages = []
    span_counter = 0

    for page_index in range(len(doc)):
        page = doc[page_index]
        rect = page.rect
        page_data = {
            "pageIndex": page_index,
            "width": rect.width,
            "height": rect.height,
            "spans": [],
        }

        text_dict = page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:  # only text blocks
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    if not text.strip():
                        continue

                    bbox = span["bbox"]  # [x0, y0, x1, y1]
                    origin = span.get("origin", [bbox[0], bbox[3]])
                    color_int = span.get("color", 0)
                    # color is an integer like 0x000000
                    r = ((color_int >> 16) & 0xFF) / 255
                    g = ((color_int >> 8) & 0xFF) / 255
                    b = (color_int & 0xFF) / 255
                    color_hex = rgb_to_hex(r, g, b)

                    page_data["spans"].append({
                        "id": f"span_{page_index}_{span_counter}",
                        "text": text,
                        "bbox": list(bbox),
                        "font": span.get("font", ""),
                        "size": span.get("size", 12),
                        "color": color_hex,
                        "origin": list(origin),
                    })
                    span_counter += 1

        pages.append(page_data)

    doc.close()
    return {"ok": True, "pages": pages}


def apply_edits(file_path, output_path, edits):
    """Apply text edits: redact original text, reinsert new text."""
    doc = fitz.open(file_path)

    # Group edits by page
    edits_by_page = {}
    for edit in edits:
        pi = edit["pageIndex"]
        if pi not in edits_by_page:
            edits_by_page[pi] = []
        edits_by_page[pi].append(edit)

    for page_index, page_edits in edits_by_page.items():
        page = doc[page_index]

        # First pass: add redaction annotations for all edits on this page
        for edit in page_edits:
            bbox = edit["bbox"]
            rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
            page.add_redact_annot(rect, fill=(1, 1, 1))

        # Apply all redactions at once for this page
        page.apply_redactions()

        # Second pass: insert new text
        for edit in page_edits:
            origin = edit["origin"]
            new_text = edit["newText"]
            size = edit.get("size", 12)
            font = edit.get("font", "")
            color_hex = edit.get("color", "#000000")

            fontname = map_fontname(font)
            color = hex_to_rgb01(color_hex)

            page.insert_text(
                fitz.Point(origin[0], origin[1]),
                new_text,
                fontsize=size,
                fontname=fontname,
                color=color,
            )

    doc.save(output_path)
    doc.close()
    return {"ok": True}


def main():
    try:
        raw = sys.stdin.read()
        cmd = json.loads(raw)

        action = cmd.get("action")

        if action == "extract":
            result = extract_text(cmd["filePath"])
        elif action == "apply_edits":
            result = apply_edits(cmd["filePath"], cmd["outputPath"], cmd["edits"])
        else:
            result = {"ok": False, "error": f"Unknown action: {action}"}

        sys.stdout.write(json.dumps(result))
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()
