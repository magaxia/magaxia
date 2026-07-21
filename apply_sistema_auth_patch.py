from pathlib import Path
import re

ref_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth.js")
diff_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-diff-full.txt")

cur_lines = ref_path.read_text(encoding='utf-8').splitlines()
diff_lines = diff_path.read_text(encoding='utf-8').splitlines()

hunk_re = re.compile(r'^@@ -(?P<a>\d+),(?P<ac>\d+) \+(?P<b>\d+),(?P<bc>\d+) @@')
output = []
cur_idx = 0
line_idx = 0

while line_idx < len(diff_lines) and not diff_lines[line_idx].startswith('@@ '):
    line_idx += 1

while line_idx < len(diff_lines):
    header = diff_lines[line_idx]
    m = hunk_re.match(header)
    if not m:
        raise ValueError(f'Invalid hunk header: {header}')
    a = int(m.group('a'))
    ac = int(m.group('ac'))
    b = int(m.group('b'))
    bc = int(m.group('bc'))

    # copy unchanged lines from current file up to start of hunk
    while cur_idx < b - 1:
        output.append(cur_lines[cur_idx])
        cur_idx += 1

    line_idx += 1
    while line_idx < len(diff_lines) and not diff_lines[line_idx].startswith('@@ '):
        line = diff_lines[line_idx]
        if line.startswith(' '):
            output.append(line[1:])
            cur_idx += 1
        elif line.startswith('-'):
            cur_idx += 1
        elif line.startswith('+'):
            output.append(line[1:])
        elif line.startswith('\\'):
            pass
        elif line == '':
            output.append('')
            cur_idx += 1
        else:
            raise ValueError(f'Unexpected diff line: {repr(line)} at {line_idx}')
        line_idx += 1

while cur_idx < len(cur_lines):
    output.append(cur_lines[cur_idx])
    cur_idx += 1

out_text = '\n'.join(output) + '\n'
out_path = ref_path
out_path.write_text(out_text, encoding='utf-8')
print('WROTE', out_path)
print('LINE_COUNT', len(output))
