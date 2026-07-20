import os
import re
from collections import defaultdict
root = os.getcwd()
ignored = {'node_modules', '.git', 'auditoria'}
file_paths = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in ignored]
    for fname in filenames:
        if re.search(r'\.(js|mjs|html|rules|json)$', fname, re.I):
            file_paths.append(os.path.join(dirpath, fname))

def get_lines(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.readlines()

def search_lines(path, pattern):
    result = []
    for i, line in enumerate(get_lines(path), 1):
        if re.search(pattern, line):
            result.append((i, line.strip()))
    return result

func_defs = defaultdict(list)
func_calls = defaultdict(list)
collections = defaultdict(set)
query_fields = defaultdict(set)
fields_by_collection = defaultdict(set)
localstorage_keys = defaultdict(set)

definition_patterns = [r'function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(', r'const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*async\s*\(', r'const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\(', r'export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(']
call_pattern = re.compile(r'([A-Za-z_$][A-Za-z0-9_$]*)\s*\(')
collection_pattern = re.compile(r'\bcollection\s*\(\s*db\s*,\s*["\"]([^"\"]+)["\"]')
compat_collection_pattern = re.compile(r'\.collection\(\s*["\"]([^"\"]+)["\"]')
where_pattern = re.compile(r'\.where\(\s*["\"]([^"\"]+)["\"]\s*,\s*["\"]([^"\"]+)["\"]')
storage_pattern = re.compile(r'localStorage\.(?:getItem|setItem|removeItem)\(\s*["\"]([^"\"]+)["\"]\s*\)|sessionStorage\.(?:getItem|setItem|removeItem)\(\s*["\"]([^"\"]+)["\"]\s*\)')

for path in sorted(file_paths):
    lines = get_lines(path)
    for i, line in enumerate(lines, 1):
        for pat in definition_patterns:
            for m in re.finditer(pat, line):
                func_defs[m.group(1)].append((path, i, line.strip()))
        for m in re.finditer(call_pattern, line):
            name = m.group(1)
            func_calls[name].append((path, i, line.strip()))
        for m in re.finditer(collection_pattern, line):
            collections[path].add(m.group(1))
        for m in re.finditer(compat_collection_pattern, line):
            collections[path].add(m.group(1))
        for m in re.finditer(where_pattern, line):
            field, op = m.groups()
            query_fields[path].add((field, op))
            # attempt to identify the collection in the same line or nearby
            if 'collection(' in line or '.collection(' in line:
                coll = None
                match = re.search(r'\.collection\(\s*["\"]([^"\"]+)["\"]', line)
                if match: coll = match.group(1)
                else:
                    match = re.search(r'collection\(\s*db\s*,\s*["\"]([^"\"]+)["\"]', line)
                    if match: coll = match.group(1)
                if coll:
                    fields_by_collection[coll].add(field)
        for m in re.finditer(storage_pattern, line):
            key = m.group(1) or m.group(2)
            if key:
                localstorage_keys[path].add(key)

unused_functions = []
for func, defs in func_defs.items():
    total_refs = 0
    if func in func_calls:
        total_refs = len(func_calls[func])
    if total_refs == len(defs):
        for def_entry in defs:
            unused_functions.append((func, def_entry))

called_but_undef = []
for func, calls in func_calls.items():
    if func not in func_defs and func not in {
        'console','window','document','addEventListener','setTimeout','setInterval','JSON','fetch','import','await','return','if','new','const','let','var','typeof','function','class','export','async','false','true','null','Array','Object','String','Number','Date','Promise','parseInt','parseFloat','require','alert','prompt','confirm','setTimeout','clearTimeout','setInterval','clearInterval','console','Math','String','Number','Boolean','RegExp','encodeURIComponent','decodeURIComponent','URL','URLSearchParams','history','location','localStorage','sessionStorage','navigator','screen','fetch','requestAnimationFrame','cancelAnimationFrame','btoa','atob','XMLHttpRequest','window','document','module','exports','process'}:
        called_but_undef.append((func, len(calls), calls[:5]))

print('--- COLLECTIONS BY FILE ---')
for path, cols in sorted(collections.items()):
    if cols:
        print(path)
        for c in sorted(cols):
            print('  ', c)
print('\n--- QUERY FIELDS BY FILE ---')
for path, fields in sorted(query_fields.items()):
    if fields:
        print(path)
        for field, op in sorted(fields):
            print('  ', field, op)
print('\n--- FIELDS BY COLLECTION (inferred) ---')
for coll, fields in sorted(fields_by_collection.items()):
    print(coll, sorted(fields))
print('\n--- LOCALSTORAGE KEYS ---')
for path, keys in sorted(localstorage_keys.items()):
    print(path)
    for key in sorted(keys):
        print('  ', key)
print('\n--- UNUSED FUNCTIONS SAMPLE ---')
for func, (path,i,line) in unused_functions[:100]:
    print(func, path, i, line)
print('\n--- CALLED BUT NO DEF SAMPLE ---')
for func, count, sample in sorted(called_but_undef, key=lambda x: (-x[1], x[0]))[:100]:
    print(func, count, sample)
