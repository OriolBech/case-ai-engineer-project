#!/usr/bin/env python3
"""Render docs/2-pager/2-pager.md → 2-pager.pdf (A4, Chrome headless)."""

from __future__ import annotations

import html
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "2-pager" / "2-pager.md"
HTML_OUT = ROOT / "docs" / "2-pager" / "2-pager.html"
PDF_OUT = ROOT / "docs" / "2-pager" / "2-pager.pdf"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

CSS = """
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap");

:root {
  --red: #c94d43;
  --ink: #434240;
  --ink-2: #6b6764;
  --ink-3: #878482;
  --paper: #f7f4f0;
  --rule: #d5d1cc;
  --head: #efebe6;
  --font: "DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}

@page { size: A4; margin: 9mm 11mm 9mm 11mm; }

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font);
  font-size: 8.15pt;
  line-height: 1.25;
  color: var(--ink);
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

h1 {
  font-size: 13.5pt;
  font-weight: 500;
  letter-spacing: -0.025em;
  margin: 0 0 0.55em;
  padding: 0 0 0.28em;
  border-bottom: 2px solid var(--red);
  color: var(--ink);
}
h1 .meta {
  display: block;
  font-size: 8pt;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 0.18em;
}

h2 {
  font-size: 9.3pt;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0.55em 0 0.18em;
  color: var(--ink);
  break-after: avoid;
  page-break-after: avoid;
}
h2.page-break {
  break-before: page;
  page-break-before: always;
  margin-top: 0;
}
h2 .n {
  color: var(--red);
  font-family: var(--mono);
  font-weight: 500;
  font-size: 8.2pt;
  margin-right: 0.35em;
}

p { margin: 0.22em 0; }
p + p { margin-top: 0.32em; }

strong { font-weight: 650; }
em { font-style: italic; }
code {
  font-family: var(--mono);
  font-size: 0.88em;
  font-feature-settings: "tnum";
  background: #efebe6;
  padding: 0 0.18em;
}

blockquote {
  margin: 0.28em 0;
  padding: 0.22em 0.65em;
  border-left: 3px solid var(--red);
  background: #f8f4ef;
  break-inside: avoid;
  page-break-inside: avoid;
}
blockquote p { margin: 0; }

ol { margin: 0.28em 0 0.28em 1.2em; padding: 0; }
ol li { margin: 0.12em 0; padding-left: 0.15em; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.28em 0 0.38em;
  font-size: 7.45pt;
  line-height: 1.26;
  break-inside: auto;
}
table.kv { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td {
  text-align: left;
  vertical-align: top;
  padding: 0.18em 0.45em 0.18em 0;
  border-bottom: 1px solid var(--rule);
}
th {
  font-weight: 600;
  color: var(--ink-3);
  font-size: 6.8pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--ink);
  padding-bottom: 0.22em;
}
td:first-child { font-weight: 550; width: 22%; }
table.kv td:first-child { width: 28%; font-weight: 600; }
table.wide td:first-child { width: 18%; }

.flow {
  font-family: var(--mono);
  font-size: 7.4pt;
  background: #f8f4ef;
  padding: 0.35em 0.55em;
  margin: 0.2em 0 0.4em;
  border: 1px solid var(--rule);
  line-height: 1.4;
}
"""


def inline(text: str) -> str:
    parts: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("**", i):
            j = text.find("**", i + 2)
            if j != -1:
                parts.append("<strong>" + inline(text[i + 2 : j]) + "</strong>")
                i = j + 2
                continue
        if text[i] == "`":
            j = text.find("`", i + 1)
            if j != -1:
                parts.append("<code>" + html.escape(text[i + 1 : j]) + "</code>")
                i = j + 1
                continue
        if text[i] == "*" and (i + 1 < n and text[i + 1] != " "):
            j = text.find("*", i + 1)
            if j != -1 and not text.startswith("**", i):
                parts.append("<em>" + inline(text[i + 1 : j]) + "</em>")
                i = j + 1
                continue
        j = i
        while j < n and text[j] not in "*`":
            j += 1
        if j == i:
            parts.append(html.escape(text[i]))
            i += 1
        else:
            parts.append(html.escape(text[i:j]))
            i = j
    return "".join(parts)


def is_table_row(line: str) -> bool:
    s = line.strip()
    return s.startswith("|") and s.endswith("|")


def is_sep(line: str) -> bool:
    s = line.strip().replace(" ", "")
    return bool(re.fullmatch(r"\|?(:?-{3,}:?\|)+", s))


def cells(line: str) -> list[str]:
    raw = [c.strip() for c in line.strip().strip("|").split("|")]
    return raw


def render_table(rows: list[str]) -> str:
    body_rows = [r for r in rows if not is_sep(r)]
    if not body_rows:
        return ""
    head = cells(body_rows[0])
    data = [cells(r) for r in body_rows[1:]]
    empty_first = head[0] == ""
    cls = "kv" if empty_first else ("wide" if len(head) >= 4 else "")
    class_attr = f' class="{cls}"' if cls else ""
    out = [f"<table{class_attr}><thead><tr>"]
    for c in head:
        out.append(f"<th>{inline(c) if c else ''}</th>")
    out.append("</tr></thead><tbody>")
    for row in data:
        out.append("<tr>")
        for c in row:
            out.append(f"<td>{inline(c)}</td>")
        out.append("</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def blocks(md: str) -> list[str]:
    lines = md.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("# ") and not line.startswith("## "):
            title = line[2:].strip()
            if "·" in title:
                main, _, who = title.partition("·")
                out.append(
                    f'<h1><span class="meta">{inline(who.strip())}</span>'
                    f"{inline(main.strip())}</h1>"
                )
            else:
                out.append(f"<h1>{inline(title)}</h1>")
            i += 1
            continue
        if line.startswith("## "):
            raw = line[3:].strip()
            m = re.match(r"^(\d+)\.\s+(.*)$", raw)
            cls = ' class="page-break"' if m and m.group(1) == "4" else ""
            heading = (
                f'<h2{cls}><span class="n">{m.group(1)}.</span>{inline(m.group(2))}</h2>'
                if m
                else f"<h2>{inline(raw)}</h2>"
            )
            out.append(heading)
            i += 1
            continue
        if is_table_row(line):
            chunk: list[str] = []
            while i < len(lines) and is_table_row(lines[i]):
                chunk.append(lines[i])
                i += 1
            out.append(render_table(chunk))
            continue
        if line.startswith(">"):
            quote: list[str] = []
            while i < len(lines) and lines[i].startswith(">"):
                quote.append(lines[i].lstrip("> ").rstrip())
                i += 1
            out.append("<blockquote><p>" + inline(" ".join(quote)) + "</p></blockquote>")
            continue
        if re.match(r"^\d+\.\s", line):
            items: list[str] = []
            while i < len(lines):
                if re.match(r"^\d+\.\s", lines[i]):
                    items.append(re.sub(r"^\d+\.\s+", "", lines[i].strip()))
                    i += 1
                    while (
                        i < len(lines)
                        and lines[i].strip()
                        and not re.match(r"^\d+\.\s", lines[i])
                        and not lines[i].startswith("#")
                        and not lines[i].startswith(">")
                        and not is_table_row(lines[i])
                    ):
                        items[-1] += " " + lines[i].strip()
                        i += 1
                    continue
                break
            lis = "".join(f"<li>{inline(it)}</li>" for it in items)
            out.append(f"<ol>{lis}</ol>")
            continue
        para: list[str] = []
        while (
            i < len(lines)
            and lines[i].strip()
            and not lines[i].startswith("#")
            and not lines[i].startswith(">")
            and not is_table_row(lines[i])
            and not re.match(r"^\d+\.\s", lines[i])
        ):
            para.append(lines[i].strip())
            i += 1
        text = " ".join(para)
        cls = ' class="flow"' if text.startswith("Excel →") else ""
        out.append(f"<p{cls}>{inline(text)}</p>")
    return out


def md_to_html(md: str) -> str:
    body = "\n".join(blocks(md))
    return (
        "<!DOCTYPE html>\n<html lang='es'>\n<head>\n"
        "<meta charset='utf-8'>\n"
        "<title>Normalización de tornillería desde MTOs · Oriol Bech</title>\n"
        f"<style>{CSS}</style>\n"
        "</head>\n<body>\n"
        f"{body}\n"
        "</body>\n</html>\n"
    )


def pdf_pages(path: Path) -> int | None:
    data = path.read_bytes()
    # Prefer the catalog Count; fall back to page object tally.
    m = re.search(rb"/Type\s*/Pages[^>]*?/Count\s+(\d+)", data)
    if m:
        return int(m.group(1))
    return len(re.findall(rb"/Type\s*/Page[^s]", data)) or None


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}", file=sys.stderr)
        return 1
    if not CHROME.exists():
        print(f"missing Chrome at {CHROME}", file=sys.stderr)
        return 1
    html_doc = md_to_html(SRC.read_text(encoding="utf-8"))
    HTML_OUT.write_text(html_doc, encoding="utf-8")
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(CHROME),
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--virtual-time-budget=12000",
        f"--print-to-pdf={PDF_OUT}",
        HTML_OUT.as_uri(),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr or r.stdout, file=sys.stderr)
        return r.returncode
    pages = pdf_pages(PDF_OUT)
    print(f"wrote {PDF_OUT.relative_to(ROOT)}  pages={pages}  bytes={PDF_OUT.stat().st_size}")
    if pages is not None and pages != 2:
        print(f"WARNING: expected 2 pages, got {pages}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
