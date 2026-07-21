from pathlib import Path
import re

diff_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-diff-full.txt")
ref_path = Path(r"C:\Users\Kalebi\Downloads\Greeting-Bot\Greeting-Bot\sistema-auth.js")
recovered_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-original-precopy.js")

diff_lines = diff_path.read_text(encoding='utf-8').splitlines()
ref_lines = ref_path.read_text(encoding='utf-8').splitlines()
output = []
ref_index = 0

def parse_hunk_header(header):
    m = re.match(r"@@ -(?P<a>\d+),(?P<ac>\d+) \+(?P<b>\d+),(?P<bc>\d+) @@", header)
    if not m:
        raise ValueError(f"Invalid hunk header: {header}")
    return int(m.group('a')), int(m.group('ac')), int(m.group('b')), int(m.group('bc'))

i = 0
while i < len(diff_lines) and not diff_lines[i].startswith('@@ '):
    i += 1

while i < len(diff_lines):
    header = diff_lines[i]
    if not header.startswith('@@ '):
        i += 1
        continue
    _, _, b_start, _ = parse_hunk_header(header)
    while ref_index < b_start - 1:
        output.append(ref_lines[ref_index])
        ref_index += 1
    i += 1
    while i < len(diff_lines) and not diff_lines[i].startswith('@@ '):
        line = diff_lines[i]
        if line.startswith(' '):
            output.append(line[1:])
            ref_index += 1
        elif line.startswith('-'):
            ref_index += 1
        elif line.startswith('+'):
            output.append(line[1:])
        i += 1

while ref_index < len(ref_lines):
    output.append(ref_lines[ref_index])
    ref_index += 1

recovered_text = '\n'.join(output) + '\n'
recovered_path.write_text(recovered_text, encoding='utf-8')

pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?function\s*\(|^\s*([A-Za-z0-9_]+)\s*:\s*\([^\)]*\)\s*=>', re.MULTILINE)
cur_funcs = [m.group(1) or m.group(2) for m in pattern.finditer(recovered_text)]
ref_funcs = [m.group(1) or m.group(2) for m in pattern.finditer(ref_path.read_text(encoding='utf-8'))]

print('RESTORED_PATH=', recovered_path)
print('RESTORED_HASH=', Path(recovered_path).read_bytes().hex())
print('CURRENT_FUNCS', len(cur_funcs))
for f in cur_funcs:
    print(f)
print('---')
print('REF_FUNCS', len(ref_funcs))
for f in ref_funcs:
    print(f)
print('---')
only_ref = sorted(set(ref_funcs) - set(cur_funcs))
only_cur = sorted(set(cur_funcs) - set(ref_funcs))
print('ONLY_IN_REF', only_ref)
print('ONLY_IN_CURRENT', only_cur)
