from pathlib import Path
import re

def extract_functions(text):
    pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?function\s*\(|^\s*([A-Za-z0-9_]+)\s*:\s*\([^\)]*\)\s*=>', re.MULTILINE)
    funcs = []
    for m in pattern.finditer(text):
        funcs.append(m.group(1) or m.group(2))
    return funcs

paths = {
    'recovered': Path(r'C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-original-precopy.js'),
    'current': Path(r'C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth.js'),
    'reference': Path(r'C:\Users\Kalebi\Downloads\Greeting-Bot\Greeting-Bot\sistema-auth.js')
}
texts = {name: path.read_text(encoding='utf-8') for name, path in paths.items()}
funcs = {name: extract_functions(text) for name, text in texts.items()}

print('--- CURRENT PROJECT FILE (RECOVERED) ---')
print(len(funcs['recovered']))
for f in funcs['recovered']:
    print(f)
print('--- REFERENCE FILE ---')
print(len(funcs['reference']))
for f in funcs['reference']:
    print(f)
print('--- ONLY IN REFERENCE ---')
print(sorted(set(funcs['reference']) - set(funcs['recovered'])))
print('--- ONLY IN RECOVERED CURRENT ---')
print(sorted(set(funcs['recovered']) - set(funcs['reference'])))

# Detect altered functions by comparing line numbers of definitions and diff hunks
import difflib
ref_lines = texts['reference'].splitlines()
cur_lines = texts['recovered'].splitlines()
matcher = difflib.SequenceMatcher(a=ref_lines, b=cur_lines)
blocks = matcher.get_opcodes()
changed_funcs = set()
for tag, i1, i2, j1, j2 in blocks:
    if tag != 'equal':
        # find nearest function definition in recovered current within changed block region
        for idx in range(max(0, j1-10), min(len(cur_lines), j2+10)):
            line = cur_lines[idx]
            m = re.match(r'^\s*([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?function\s*\(|^\s*([A-Za-z0-9_]+)\s*:\s*\([^\)]*\)\s*=>', line)
            if m:
                changed_funcs.add(m.group(1) or m.group(2))
        for idx in range(max(0, i1-10), min(len(ref_lines), i2+10)):
            line = ref_lines[idx]
            m = re.match(r'^\s*([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?function\s*\(|^\s*([A-Za-z0-9_]+)\s*:\s*\([^\)]*\)\s*=>', line)
            if m:
                changed_funcs.add(m.group(1) or m.group(2))
print('--- ALTERED FUNCTIONS ---')
print(sorted(changed_funcs))
