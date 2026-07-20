import os
import re
import json

root = os.getcwd()
ignored = {'node_modules', '.git', 'auditoria'}
refs = []

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in ignored]
    for fname in filenames:
        if not re.search(r'\.(js|mjs|html|css|json|md)$', fname, re.I):
            continue
        path = os.path.join(dirpath, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception:
            with open(path, 'r', encoding='latin1') as f:
                text = f.read()
        patterns = []
        patterns += re.findall(r'\b(?:href|src)\s*=\s*["\']([^"\']+)["\']', text)
        patterns += re.findall(r'\bimport\s+[^;]+?from\s+["\']([^"\']+)["\']', text)
        patterns += re.findall(r'\bimport\s*["\']([^"\']+)["\']', text)
        patterns += re.findall(r'\bfetch\(\s*["\']([^"\']+)["\']', text)
        patterns += re.findall(r'window\.location\.href\s*=\s*["\']([^"\']+)["\']', text)
        patterns += re.findall(r'location\.href\s*=\s*["\']([^"\']+)["\']', text)
        patterns += re.findall(r'\bnew URL\(.*?["\']([^"\']+)["\']', text)
        patterns += re.findall(r'\bimport\(\s*["\']([^"\']+)["\']', text)
        for ref in set(patterns):
            refs.append((path, ref))

missing = []
modules = []
endpoints = []

for path, ref in refs:
    if re.match(r'^(https?:|//|mailto:|data:)', ref):
        if re.match(r'^(https?://(?:localhost|127\.0\.0\.1|\[::1\])|//localhost)', ref):
            endpoints.append((path, ref))
        continue
    if re.match(r'^\w+:/', ref):
        continue
    if ref.startswith('/'):
        abs_path = os.path.join(root, ref.lstrip('/'))
    else:
        abs_path = os.path.normpath(os.path.join(os.path.dirname(path), ref))
    if os.path.exists(abs_path):
        continue
    if re.search(r'\.(js|mjs|html|css|json)$', ref):
        missing.append((path, ref, abs_path))
    else:
        if ref.startswith('.'):
            found = False
            for ext in ['.js', '.mjs', '.json', '.css', '.html']:
                if os.path.exists(abs_path + ext):
                    found = True
                    break
            if not found:
                modules.append((path, ref))
        else:
            modules.append((path, ref))

# Collect Firestore collection references and query patterns
collections = set()
query_patterns = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in ignored]
    for fname in filenames:
        if not re.search(r'\.(js|mjs|html)$', fname, re.I):
            continue
        path = os.path.join(dirpath, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception:
            with open(path, 'r', encoding='latin1') as f:
                text = f.read()
        for m in re.findall(r"collection\s*\(\s*db\s*,\s*['\"]([^'\"]+)['\"]", text):
            collections.add(m)
        for m in re.findall(r"\.collection\(\s*['\"]([^'\"]+)['\"]", text):
            collections.add(m)
        for m in re.findall(r"doc\s*\(\s*db\s*,\s*['\"]([^'\"]+)['\"]", text):
            collections.add(m)
        for m in re.findall(r"where\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", text):
            # capture filter fields
            query_patterns.append((path, m[0], m[1]))
        for m in re.findall(r"orderBy\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", text):
            query_patterns.append((path, 'orderBy', m[0], m[1]))

# Firestore rules collection names
rules_collections = set()
if os.path.exists(os.path.join(root, 'firestore.rules')):
    with open(os.path.join(root, 'firestore.rules'), 'r', encoding='utf-8') as f:
        rules_text = f.read()
    for m in re.findall(r"match\s*/([^/\{]+)", rules_text):
        rules_collections.add(m)

# Firestore index definitions
indexes = []
if os.path.exists(os.path.join(root, 'firestore.indexes.json')):
    with open(os.path.join(root, 'firestore.indexes.json'), 'r', encoding='utf-8') as f:
        idx_data = json.load(f)
    for entry in idx_data.get('indexes', []):
        indexes.append({
            'collectionGroup': entry.get('collectionGroup'),
            'fields': [(field.get('fieldPath'), field.get('order')) for field in entry.get('fields', [])]
        })

output = {
    'missing': missing,
    'modules': modules,
    'endpoints': endpoints,
    'collections_in_code': sorted(collections),
    'rules_collections': sorted(rules_collections),
    'indexes': indexes,
    'query_patterns': query_patterns,
}
print(json.dumps(output, ensure_ascii=False, indent=2))
