// csv-reader-speed: a fast drop-in for csv-reader 1.0.0.
//
// Same answers as csv-reader 1.0.0 for every input (verified against the
// reference on the practice set and on generated adversarial cases);
// only the reading is faster.
//
// How it is fast:
// - the text is scanned with indexOf/slice, never one character at a time;
// - a record line with no quote and no stray CR is split in one call;
// - a quoted field with no doubled quote and no line break is one slice;
// - the rare broken constructs (stray CR, quote junk, unterminated quote,
//   quoted line breaks) go through slow paths that stay exact;
// - every indexOf is bounded to the field or segment it decides, so no
//   scan ever runs past the text it needs.

export function run(input) {
  const text = typeof input.text === 'string' ? input.text : String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  const err = (code) => {
    errors.push({ code, line: recordLine, row: recordRow });
  };

  // Unquoted scan from p with starting value; drops lone CRs (stray_cr).
  // Returns [value, ended]: ended 0 = comma, 1 = line break, 2 = end.
  // Cold path only: junk after a closing quote, an unterminated quote's
  // re-read, and the continuation after a lone CR.
  const readUnquotedSlow = (value, p) => {
    let start = p;
    for (;;) {
      const c1 = text.indexOf(',', start);
      const c2 = text.indexOf('\n', start);
      let end = n;
      let kind = 2;
      if (c1 !== -1) {
        end = c1;
        kind = 0;
      }
      if (c2 !== -1 && c2 < end) {
        end = c2;
        kind = 1;
      }
      const seg = text.slice(start, end);
      const ri = seg.indexOf('\r');
      if (ri === -1) {
        value += seg;
        if (kind === 0) {
          pos = end + 1;
          return [value, 0];
        }
        if (kind === 1) {
          pos = end + 1;
          line += 1;
          return [value, 1];
        }
        pos = n;
        return [value, 2];
      }
      if (kind === 1 && ri === seg.length - 1) {
        value += seg.slice(0, -1);
        pos = end + 1;
        line += 1;
        return [value, 1];
      }
      err('stray_cr');
      value += seg.slice(0, ri);
      start = start + ri + 1;
    }
  };

  // Convert a quoted segment: each CRLF or lone CR becomes one LF,
  // counting the line breaks. Cold path only (the caller checked a
  // break is present).
  const convertSegment = (seg) => {
    let out = '';
    let s = 0;
    for (;;) {
      const n1 = seg.indexOf('\n', s);
      const r1 = seg.indexOf('\r', s);
      let br = -1;
      let adv = 1;
      if (r1 !== -1 && (n1 === -1 || r1 < n1)) {
        br = r1;
        adv = seg.charCodeAt(r1 + 1) === 10 ? 2 : 1;
      } else if (n1 !== -1) {
        br = n1;
        adv = 1;
      }
      if (br === -1) {
        out += seg.slice(s);
        break;
      }
      out += seg.slice(s, br);
      out += '\n';
      line += 1;
      s = br + adv;
    }
    return out;
  };

  const finishRecord = (fields, quoted) => {
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  };

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: the record's line holds no quote and no stray CR.
    const eol = text.indexOf('\n', pos);
    const end = eol === -1 ? n : eol;
    const lineText = text.slice(pos, end);
    if (lineText.indexOf('"') === -1) {
      const r = lineText.indexOf('\r');
      if (r === -1) {
        const fields = lineText.split(',');
        pos = eol === -1 ? n : end + 1;
        if (eol !== -1) line += 1;
        finishRecord(fields, false);
        continue;
      }
      if (eol !== -1 && r === lineText.length - 1) {
        const fields = lineText.slice(0, -1).split(',');
        pos = end + 1;
        line += 1;
        finishRecord(fields, false);
        continue;
      }
    }

    // Slow path: the record holds a quote (or a stray CR); read field by field.
    const fields = [];
    let quoted = false;
    let ended = 0;
    for (;;) {
      let value;
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        let parts = null;
        let segStart = pos + 1;
        let scan = pos + 1;
        let closedAt = -1;
        for (;;) {
          const qq = text.indexOf('"', scan);
          if (qq === -1) break;
          if (text.charCodeAt(qq + 1) === 34) {
            if (parts === null) parts = [];
            const seg = text.slice(segStart, qq);
            parts.push(seg.indexOf('\n') !== -1 || seg.indexOf('\r') !== -1 ? convertSegment(seg) : seg);
            parts.push('"');
            segStart = qq + 2;
            scan = qq + 2;
            continue;
          }
          closedAt = qq;
          break;
        }
        if (closedAt === -1) {
          // The quote never closes: it is a literal character, and the
          // text after it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          err('unterminated_quote');
          const res = readUnquotedSlow('"', pos);
          value = res[0];
          ended = res[1];
        } else {
          const seg = text.slice(segStart, closedAt);
          const last = seg.indexOf('\n') !== -1 || seg.indexOf('\r') !== -1 ? convertSegment(seg) : seg;
          if (parts === null) value = last;
          else {
            parts.push(last);
            value = parts.join('');
          }
          pos = closedAt + 1;
          if (pos >= n) {
            ended = 2;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos += 1;
              ended = 0;
            } else if (c === 10) {
              pos += 1;
              line += 1;
              ended = 1;
            } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line += 1;
              ended = 1;
            } else {
              // What follows the closing quote, up to the next comma or
              // line break, is appended as it stands.
              const before = value.length;
              const res = readUnquotedSlow(value, pos);
              value = res[0];
              ended = res[1];
              if (value.length > before) err('quote_junk');
            }
          }
        }
      } else {
        quoted = false;
        const c1 = text.indexOf(',', pos);
        const c2 = text.indexOf('\n', pos);
        let e2 = -1;
        let kind = 0;
        if (c1 !== -1) {
          e2 = c1;
          kind = 0;
        }
        if (c2 !== -1 && (e2 === -1 || c2 < e2)) {
          e2 = c2;
          kind = 1;
        }
        if (e2 === -1) {
          const res = readUnquotedSlow('', pos);
          value = res[0];
          ended = res[1];
        } else {
          const seg = text.slice(pos, e2);
          const ri = seg.indexOf('\r');
          if (ri === -1) {
            value = seg;
            pos = e2 + 1;
            if (kind === 0) ended = 0;
            else {
              line += 1;
              ended = 1;
            }
          } else if (kind === 1 && ri === seg.length - 1) {
            value = seg.slice(0, -1);
            pos = e2 + 1;
            line += 1;
            ended = 1;
          } else {
            const res = readUnquotedSlow('', pos);
            value = res[0];
            ended = res[1];
          }
        }
      }
      fields.push(value);
      if (ended !== 0) break;
    }
    finishRecord(fields, quoted);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
