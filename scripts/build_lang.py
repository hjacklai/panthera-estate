#!/usr/bin/env python3
"""build_lang.py: writes the Bahasa Malaysia and Chinese home pages, ms/index.html and zh/index.html.

Why: the site switches language in place with JavaScript (app.js), but search engines and AI crawlers (GPTBot,
ClaudeBot, PerplexityBot) do not run it, so they only ever saw English. /ms/ and /zh/ are real pages whose HTML
already holds the translated text, made here from index.html and the I18N dictionaries in app.js.

    python scripts/build_lang.py           write ms/index.html and zh/index.html
    python scripts/build_lang.py --check   change nothing; exit 1 if either page is missing or out of date

Run it after ANY change to index.html or to the I18N strings in app.js (and after a build or ?v= bump, so the
pages carry the same stamps), then commit the two pages with the change. The output depends only on those two
files, so running it twice gives the same bytes, on any computer (line endings are normalised to LF).

What it mirrors (app.js applyI18n): data-i18n -> the element's text (textContent), data-i18n-html -> its HTML,
data-i18n-aria -> aria-label, data-i18n-alt -> alt, .lang buttons -> aria-pressed, body.lang-zh for Chinese.
A key missing in BM or ZH leaves the English that is in index.html, exactly as app.js does. The <head> gets the
page's own title, description, share cards (meta.* keys), canonical and og:url; the hreflang block is the same
on all three pages. In the JSON-LD the FAQPage is rebuilt from the page's visible (translated) FAQ, and the
WebPage node gets the page's address, language, title and description; every other fact stays as in index.html.
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.pantheraestate.com/'
# dictionary key in app.js -> folder, <html lang>, og:locale
LANGS = [
    ('bm', 'ms', 'ms', 'ms_MY'),
    ('zh', 'zh', 'zh-Hans', 'zh_CN'),
]
EN_LOCALE = 'en_GB'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
RAW = {'script', 'style', 'textarea', 'title'}
TAG = re.compile(r'<!--.*?-->|<(/?)([A-Za-z][A-Za-z0-9:-]*)((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>', re.S)
ATTR = re.compile(r'([^\s=/>"\']+)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+))?')


class BuildError(Exception):
    pass


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8', newline='') as f:
        return f.read().replace('\r\n', '\n')


# ---------------------------------------------------------------- app.js: the I18N object literal
class JsLiteral:
    """Reads the plain JS object literal `const I18N = { en: { "k": "v", ... }, ... };`: string or bare keys, string
    values, nested objects, // and /* */ comments, trailing commas. Anything else is an error, never a guess."""

    def __init__(self, src, pos):
        self.s, self.i = src, pos

    def err(self, msg):
        line = self.s.count('\n', 0, self.i) + 1
        raise BuildError('app.js line %d: %s' % (line, msg))

    def ws(self):
        s = self.s
        while self.i < len(s):
            c = s[self.i]
            if c in ' \t\r\n':
                self.i += 1
            elif s.startswith('//', self.i):
                j = s.find('\n', self.i)
                self.i = len(s) if j < 0 else j + 1
            elif s.startswith('/*', self.i):
                j = s.find('*/', self.i + 2)
                if j < 0:
                    self.err('unclosed comment')
                self.i = j + 2
            else:
                return

    def string(self):
        s, q = self.s, self.s[self.i]
        self.i += 1
        out = []
        while True:
            if self.i >= len(s):
                self.err('unclosed string')
            c = s[self.i]
            if c == q:
                self.i += 1
                return ''.join(out)
            if c == '\n':
                self.err('line break inside a string')
            if c == '\\':
                n = s[self.i + 1]
                self.i += 2
                if n in 'nrtbfv0':
                    out.append({'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f', 'v': '\v', '0': '\0'}[n])
                elif n == 'u':
                    if s[self.i] == '{':
                        j = s.index('}', self.i)
                        out.append(chr(int(s[self.i + 1:j], 16)))
                        self.i = j + 1
                    else:
                        out.append(chr(int(s[self.i:self.i + 4], 16)))
                        self.i += 4
                elif n == 'x':
                    out.append(chr(int(s[self.i:self.i + 2], 16)))
                    self.i += 2
                elif n == '\n':
                    pass
                else:
                    out.append(n)
                continue
            out.append(c)
            self.i += 1

    def key(self):
        if self.s[self.i] in '"\'':
            return self.string()
        m = re.compile(r'[A-Za-z_$][\w$]*').match(self.s, self.i)
        if not m:
            self.err('expected a key')
        self.i = m.end()
        return m.group(0)

    def value(self):
        self.ws()
        c = self.s[self.i]
        if c == '{':
            return self.obj()
        if c in '"\'':
            return self.string()
        self.err('expected a string or an object (template strings and expressions are not read)')

    def obj(self):
        self.i += 1
        out = {}
        while True:
            self.ws()
            if self.s[self.i] == '}':
                self.i += 1
                return out
            k = self.key()
            self.ws()
            if self.s[self.i] != ':':
                self.err('expected ":" after %r' % k)
            self.i += 1
            if k in out:
                self.err('key %r appears twice' % k)
            out[k] = self.value()
            self.ws()
            if self.s[self.i] == ',':
                self.i += 1
            elif self.s[self.i] != '}':
                self.err('expected "," or "}" after %r' % k)


def load_i18n():
    src = read('app.js')
    m = re.search(r'\bconst\s+I18N\s*=\s*', src)
    if not m:
        raise BuildError('app.js: "const I18N = {" not found')
    d = JsLiteral(src, m.end()).value()
    for k, *_ in LANGS:
        if k not in d:
            raise BuildError('app.js: I18N.%s not found' % k)
    return d


# ---------------------------------------------------------------- HTML helpers
def esc_text(v):
    return v.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def esc_attr(v):
    return esc_text(v).replace('"', '&quot;')


def text_content(fragment):
    return html.unescape(re.sub(r'<[^>]*>', '', re.sub(r'<!--.*?-->', '', fragment, flags=re.S)))


def attrs_of(raw):
    out = {}
    for m in ATTR.finditer(raw):
        v = m.group(2)
        if v is None:
            v = ''
        elif v[:1] in '"\'':
            v = v[1:-1]
        out[m.group(1).lower()] = html.unescape(v)
    return out


def set_attr(tag, name, value):
    """tag: the whole start tag text. Replaces the attribute's value, or adds it before the closing >."""
    pat = re.compile(r'(\s%s\s*=\s*)("[^"]*"|\'[^\']*\'|[^\s>]+)' % re.escape(name))
    new = '"%s"' % esc_attr(value)
    if pat.search(tag):
        return pat.sub(lambda m: m.group(1) + new, tag, count=1)
    end = len(tag) - (2 if tag.endswith('/>') else 1)
    return tag[:end].rstrip() + ' %s=%s' % (name, new) + tag[end:]


def walk(doc, start):
    """Yields (name, attrs, tag_start, tag_end, inner_end) for every element from `start`, inner_end being where its end
    tag begins (None for void / self-closed elements). Strict: a misnested end tag stops the build."""
    stack, pos, done = [], start, []
    while True:
        m = TAG.search(doc, pos)
        if not m:
            break
        pos = m.end()
        if m.group(0).startswith('<!--'):
            continue
        closing, name, raw = m.group(1), m.group(2).lower(), m.group(3)
        if closing:
            if not stack or stack[-1][0] != name:
                line = doc.count('\n', 0, m.start()) + 1
                raise BuildError('index.html line %d: </%s> does not close <%s>' % (line, name, stack[-1][0] if stack else '-'))
            el = stack.pop()
            done.append(el + (m.start(),))
            if name == 'body':
                break
            continue
        el = (name, attrs_of(raw), m.start(), m.end())
        if name in VOID or raw.rstrip().endswith('/'):
            done.append(el + (None,))
            continue
        if name in RAW:
            j = re.compile(r'</%s\s*>' % name, re.I).search(doc, pos)
            if not j:
                raise BuildError('index.html: <%s> is never closed' % name)
            done.append(el + (j.start(),))
            pos = j.end()
            continue
        stack.append(el)
    if stack:
        raise BuildError('index.html: <%s> is never closed' % stack[-1][0])
    return sorted(done, key=lambda e: e[2])


def sub_once(pattern, repl, text, what):
    out, n = re.subn(pattern, lambda m: repl(m) if callable(repl) else repl, text, count=1)
    if n != 1:
        raise BuildError('index.html: %s not found (the generator needs it; update scripts/build_lang.py if it moved)' % what)
    return out


# ---------------------------------------------------------------- one page
def build(src, i18n, key, folder, html_lang, locale):
    dict_ = i18n[key]
    url = SITE + folder + '/'
    head_end = src.index('</head>')
    body_at = src.index('<body', head_end)
    elements = walk(src, body_at)

    # ---- body: text, html, aria-label, alt, the language buttons (app.js applyI18n)
    edits = []          # (start, end, text)
    en_text = {}        # data-i18n key -> the English textContent in index.html
    faq = {}            # faq number -> (question key, answer key), in page order
    for name, at, ts, te, ie in elements:
        tag, new_tag = src[ts:te], src[ts:te]
        k = at.get('data-i18n')
        if k is not None and ie is not None:
            cur = text_content(src[te:ie])
            en_text.setdefault(k, cur)
            mq = re.match(r'faq\.([qa])(\d+)$', k)
            if mq:
                faq.setdefault(int(mq.group(2)), {})[mq.group(1)] = k
            v = dict_.get(k)
            if v is not None and v != cur:
                edits.append((te, ie, esc_text(v)))
        k = at.get('data-i18n-html')
        if k is not None and ie is not None and dict_.get(k) is not None:
            edits.append((te, ie, dict_[k]))
        for a, attr in (('data-i18n-aria', 'aria-label'), ('data-i18n-alt', 'alt')):
            k = at.get(a)
            if k is not None and dict_.get(k) is not None:
                new_tag = set_attr(new_tag, attr, dict_[k])
        if name == 'button' and 'data-lang' in at and 'aria-pressed' in at:
            new_tag = set_attr(new_tag, 'aria-pressed', 'true' if at['data-lang'] == key else 'false')
        if new_tag != tag:
            edits.append((ts, te, new_tag))
    # an element whose content is replaced takes its children with it (as textContent does): drop edits inside it.
    # The same element's text and html edits: the later (html, as in applyI18n) wins.
    whole = {}
    for e in edits:
        whole[(e[0], e[1])] = e
    edits = list(whole.values())
    tags = {(x[2], x[3]) for x in elements}
    inner = [(s, e) for s, e, t in edits if (s, e) not in tags]   # content edits (not start-tag rewrites)
    kept = [e for e in edits if not any(s <= e[0] and e[1] <= f and (s, f) != (e[0], e[1]) for s, f in inner)]
    out = src
    for s, e, t in sorted(kept, key=lambda e: e[0], reverse=True):
        out = out[:s] + t + out[e:]
    if key == 'zh':
        out = sub_once(r'<body>', '<body class="lang-zh">', out, '<body>')

    # ---- head
    en = i18n['en']
    t = lambda k: dict_.get(k) if dict_.get(k) is not None else en.get(k)
    for k in ('meta.title', 'meta.desc', 'meta.og.desc', 'meta.tw.desc', 'meta.img.alt', 'meta.tw.img.alt'):
        if t(k) is None:
            raise BuildError('app.js: I18N.en["%s"] is missing' % k)
    head, rest = out[:out.index('</head>')], out[out.index('</head>'):]
    head = sub_once(r'<html lang="[^"]*">', '<html lang="%s">' % html_lang, head, '<html lang>')
    head = sub_once(r'<title>[^<]*</title>', '<title>%s</title>' % esc_text(t('meta.title')), head, '<title>')
    meta = lambda kind, name, value, h: sub_once(r'<meta %s="%s" content="[^"]*">' % (kind, re.escape(name)),
                                                '<meta %s="%s" content="%s">' % (kind, name, esc_attr(value)), h, name)
    head = meta('name', 'description', t('meta.desc'), head)
    head = sub_once(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s">' % url, head, 'canonical')
    head = meta('property', 'og:url', url, head)
    head = meta('property', 'og:title', t('meta.title'), head)
    head = meta('property', 'og:description', t('meta.og.desc'), head)
    head = meta('property', 'og:image:alt', t('meta.img.alt'), head)
    alts = [l for l in (EN_LOCALE,) + tuple(x[3] for x in LANGS) if l != locale]
    head = sub_once(r'<meta property="og:locale" content="[^"]*">\n(?:<meta property="og:locale:alternate" content="[^"]*">\n)*',
                    '<meta property="og:locale" content="%s">\n' % locale +
                    ''.join('<meta property="og:locale:alternate" content="%s">\n' % l for l in alts), head, 'og:locale block')
    head = meta('name', 'twitter:url', url, head)
    head = meta('name', 'twitter:title', t('meta.title'), head)
    head = meta('name', 'twitter:description', t('meta.tw.desc'), head)
    head = meta('name', 'twitter:image:alt', t('meta.tw.img.alt'), head)
    if 'hreflang="%s"' % html_lang not in head or '<base href="/">' not in head:
        raise BuildError('index.html: the hreflang block or <base href="/"> is missing from <head>')

    # ---- JSON-LD: the page's own WebPage and FAQPage, everything else as it is
    m = re.search(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', head, re.S)
    if not m:
        raise BuildError('index.html: the JSON-LD block was not found')
    data = json.loads(m.group(2))
    pairs = [(faq[n]['q'], faq[n]['a']) for n in sorted(faq) if 'q' in faq[n] and 'a' in faq[n]]
    shown = lambda k: dict_[k] if dict_.get(k) is not None else en_text[k]
    for node in data.get('@graph', []):
        if node.get('@type') == 'WebPage':
            node.update({'@id': url + '#webpage', 'url': url, 'name': t('meta.title'), 'description': t('meta.desc'),
                         'inLanguage': html_lang})
        elif node.get('@type') == 'FAQPage':
            if len(pairs) != len(node.get('mainEntity', [])):
                raise BuildError('index.html: the page shows %d FAQ items but the JSON-LD has %d' % (len(pairs), len(node.get('mainEntity', []))))
            node['@id'] = url + '#faq'
            node['inLanguage'] = html_lang
            node['mainEntity'] = [{'@type': 'Question', 'name': shown(q),
                                   'acceptedAnswer': {'@type': 'Answer', 'text': shown(a)}} for q, a in pairs]
    ld = json.dumps(data, ensure_ascii=False, indent=2).replace('</', '<\\/')
    head = head[:m.start(2)] + ld + head[m.end(2):]
    out = head + rest

    note = ('<!-- GENERATED FILE: do not edit by hand. %s home page, made by scripts/build_lang.py from index.html and the\n'
            '     I18N strings in app.js. Change those, then run: python scripts/build_lang.py (README, Release steps) -->\n'
            % {'bm': 'The Bahasa Malaysia', 'zh': 'The Chinese'}[key])
    first = out.index('\n') + 1
    if not out[:first].lower().startswith('<!doctype html'):
        raise BuildError('index.html: expected <!DOCTYPE html> on its first line')
    return out[:first] + note + out[first:], en_text, pairs


# ---------------------------------------------------------------- checks on the English source
def en_warnings(src, i18n, en_text, pairs):
    warn, en = [], i18n['en']
    head = src[:src.index('</head>')]
    def meta(sel):
        m = re.search(sel, head)
        return html.unescape(m.group(1)) if m else None
    for k, sel in (('meta.title', r'<title>([^<]*)</title>'), ('meta.desc', r'<meta name="description" content="([^"]*)">'),
                   ('meta.og.desc', r'<meta property="og:description" content="([^"]*)">'),
                   ('meta.tw.desc', r'<meta name="twitter:description" content="([^"]*)">'),
                   ('meta.img.alt', r'<meta property="og:image:alt" content="([^"]*)">'),
                   ('meta.tw.img.alt', r'<meta name="twitter:image:alt" content="([^"]*)">')):
        if meta(sel) != en.get(k):
            warn.append('index.html <head> and I18N.en["%s"] differ' % k)
    m = re.search(r'<script type="application/ld\+json">\n(.*?)\n</script>', head, re.S)
    for node in json.loads(m.group(1)).get('@graph', []) if m else []:
        if node.get('@type') == 'FAQPage':
            for i, (q, a) in enumerate(pairs):
                qa = node['mainEntity'][i] if i < len(node['mainEntity']) else {}
                if qa.get('name') != en_text[q] or qa.get('acceptedAnswer', {}).get('text') != en_text[a]:
                    warn.append('index.html: FAQ %d in the JSON-LD differs from the visible English FAQ' % (i + 1))
    for k, v in en_text.items():
        if en.get(k) is not None and ' '.join(en[k].split()) != ' '.join(v.split()):
            warn.append('index.html text for "%s" differs from I18N.en (app.js shows the I18N.en text)' % k)
    return warn


def main(argv):
    check = '--check' in argv
    try:
        src, i18n = read('index.html'), load_i18n()
        pages, warns = [], []
        for key, folder, html_lang, locale in LANGS:
            page, en_text, pairs = build(src, i18n, key, folder, html_lang, locale)
            pages.append((folder + '/index.html', page))
        warns = en_warnings(src, i18n, en_text, pairs)
    except BuildError as e:
        print('build_lang: ERROR: %s' % e, file=sys.stderr)
        return 2
    for w in warns:
        print('build_lang: warning: %s' % w, file=sys.stderr)
    if chr(0x2014) in ''.join(p for _, p in pages):
        print('build_lang: warning: an em-dash (U+2014) is in the output: the house rule is none', file=sys.stderr)
    stale = []
    for rel, page in pages:
        path = os.path.join(ROOT, rel)
        try:
            with open(path, encoding='utf-8', newline='') as f:
                cur = f.read().replace('\r\n', '\n')
        except FileNotFoundError:
            cur = None
        if cur == page:
            print('build_lang: %s is up to date' % rel)
            continue
        if check:
            stale.append(rel)
            print('build_lang: OUT OF DATE: %s (run: python scripts/build_lang.py)' % rel, file=sys.stderr)
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(page)
        print('build_lang: wrote %s' % rel)
    return 1 if stale else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
