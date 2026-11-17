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


import re

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _checked_num(value, name, lo, hi):
    """Coerce to float and clamp to [lo, hi]; rejects bools/non-numbers."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Invalid {name}: not a number")
    return max(lo, min(hi, float(value)))


def hex_to_rgb01(hex_str):
    """Convert hex color string to (r, g, b) floats in 0-1 range."""
    if not isinstance(hex_str, str) or not _HEX_COLOR.match(hex_str):
        raise ValueError("Invalid color: must match ^#[0-9a-fA-F]{6}$")
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


def _checked_box(bbox, page_rect):
    """Validate a [x0, y0, x1, y1] box and clamp it inside the page."""
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        raise ValueError("Invalid bbox: must be [x0, y0, x1, y1]")
    x0 = _checked_num(bbox[0], "bbox x0", 0, page_rect.width)
    y0 = _checked_num(bbox[1], "bbox y0", 0, page_rect.height)
    x1 = _checked_num(bbox[2], "bbox x1", 0, page_rect.width)
    y1 = _checked_num(bbox[3], "bbox y1", 0, page_rect.height)
    if x1 <= x0 or y1 <= y0:
        raise ValueError("Invalid bbox: empty or inverted rectangle")
    return fitz.Rect(x0, y0, x1, y1)


def apply_edits(file_path, output_path, edits):
    """Apply text edits: redact original text, reinsert new text."""
    if not isinstance(edits, list) or len(edits) > 500:
        raise ValueError("Invalid edits: must be a list of at most 500 entries")
    doc = fitz.open(file_path)

    # Group edits by page (page indices are validated against the document)
    edits_by_page = {}
    for edit in edits:
        if not isinstance(edit, dict):
            raise ValueError("Invalid edit: must be an object")
        pi = edit.get("pageIndex")
        if isinstance(pi, bool) or not isinstance(pi, int) or not 0 <= pi < len(doc):
            raise ValueError("Invalid pageIndex: out of range")
        edits_by_page.setdefault(pi, []).append(edit)

    for page_index, page_edits in edits_by_page.items():
        page = doc[page_index]

        # First pass: add redaction annotations for all edits on this page
        for edit in page_edits:
            rect = _checked_box(edit.get("bbox"), page.rect)
            page.add_redact_annot(rect, fill=(1, 1, 1))

        # Apply all redactions at once for this page
        page.apply_redactions()

        # Second pass: insert new text
        for edit in page_edits:
            origin = edit.get("origin")
            if not isinstance(origin, (list, tuple)) or len(origin) != 2:
                raise ValueError("Invalid origin: must be [x, y]")
            new_text = edit.get("newText")
            if not isinstance(new_text, str) or len(new_text) > 20000:
                raise ValueError("Invalid newText: must be a string of at most 20000 chars")
            size = _checked_num(edit.get("size", 12), "size", 1, 200)
            font = edit.get("font", "")
            if not isinstance(font, str) or len(font) > 200:
                raise ValueError("Invalid font name")
            color_hex = edit.get("color", "#000000")

            fontname = map_fontname(font)
            color = hex_to_rgb01(color_hex)

            page.insert_text(
                fitz.Point(
                    _checked_num(origin[0], "origin x", 0, page.rect.width),
                    _checked_num(origin[1], "origin y", 0, page.rect.height),
                ),
                new_text,
                fontsize=size,
                fontname=fontname,
                color=color,
            )

    doc.save(output_path)
    doc.close()
    return {"ok": True}


def handle_command(cmd):
    """Process a single command and return result dict.

    Validation errors (ValueError) carry only constraint text, so they are
    safe to return. Anything else (e.g. fitz errors embedding file paths)
    becomes a generic failure so paths never leak to the renderer.
    """
    try:
        action = cmd.get("action")
        if action == "extract":
            return extract_text(cmd["filePath"])
        elif action == "apply_edits":
            return apply_edits(cmd["filePath"], cmd["outputPath"], cmd["edits"])
        else:
            return {"ok": False, "error": "Unknown action"}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except Exception:
        return {"ok": False, "error": "processing failed"}


def main():
    """Run in persistent mode: read one JSON command per line, write one JSON response per line."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}) + "\n")
            sys.stdout.flush()
            continue

        result = handle_command(cmd)
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
