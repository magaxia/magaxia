from pathlib import Path
import re
from hashlib import sha256

ref_path = Path(r"C:\Users\Kalebi\Downloads\Greeting-Bot\Greeting-Bot\sistema-auth.js")
diff_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-diff-full.txt")
out_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-current-precopy.js")

ref_lines = ref_path.read_text(encoding='utf-8').splitlines()
diff_lines = diff_path.read_text(encoding='utf-8').splitlines()

hunk_re = re.compile(r'^@@ -(?P<a>\d+),(?P<ac>\d+) \+(?P<b>\d+),(?P<bc>\d+) @@')
output_lines = []
ref_idx = 0

line_idx = 0
while line_idx < len(diff_lines) and not diff_lines[line_idx].startswith('@@ '):
    line_idx += 1

while line_idx < len(diff_lines):
    header = diff_lines[line_idx]
    if not header.startswith('@@ '):
        line_idx += 1
        continue
    m = hunk_re.match(header)
    if not m:
        raise ValueError(f'Invalid hunk header: {header}')
    a = int(m.group('a'))
    ac = int(m.group('ac'))
    b = int(m.group('b'))
    bc = int(m.group('bc'))
    while ref_idx < a - 1:
        output_lines.append(ref_lines[ref_idx])
        ref_idx += 1
    line_idx += 1
    # skip optional blank line after header
    while line_idx < len(diff_lines) and diff_lines[line_idx] == '':
        line_idx += 1
    while line_idx < len(diff_lines) and not diff_lines[line_idx].startswith('@@ '):
        line = diff_lines[line_idx]
        if line.startswith(' '):
            output_lines.append(line[1:])
            ref_idx += 1
        elif line.startswith('-'):
            ref_idx += 1
        elif line.startswith('+'):
            output_lines.append(line[1:])
        elif line.startswith('\\'):
            pass
        else:
            raise ValueError(f'Unexpected diff line: {repr(line)} at {line_idx}')
        line_idx += 1

while ref_idx < len(ref_lines):
    output_lines.append(ref_lines[ref_idx])
    ref_idx += 1

text = '\n'.join(output_lines) + '\n'
out_path.write_text(text, encoding='utf-8')
print('RESTORED_PATH=', out_path)
print('RESTORED_HASH=', sha256(text.encode('utf-8')).hexdigest())
print('RESTORED_LINES=', len(output_lines))

pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?function\s*\(|^\s*([A-Za-z0-9_]+)\s*:\s*\([^\)]*\)\s*=>', re.MULTILINE)
recovered_funcs = [m.group(1) or m.group(2) for m in pattern.finditer(text)]
ref_funcs = [m.group(1) or m.group(2) for m in pattern.finditer(ref_path.read_text(encoding='utf-8'))]
print('RECOVERED_FUNCS', len(recovered_funcs))
for f in recovered_funcs:
    print(f)
print('---')
print('REF_FUNCS', len(ref_funcs))
for f in ref_funcs:
    print(f)
print('---')
print('ONLY_IN_REF', sorted(set(ref_funcs) - set(recovered_funcs)))
print('ONLY_IN_RECOVERED', sorted(set(recovered_funcs) - set(ref_funcs)))
