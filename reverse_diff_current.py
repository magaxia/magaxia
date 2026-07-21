from pathlib import Path
import re

ref_path = Path(r"C:\Users\Kalebi\Downloads\Greeting-Bot\Greeting-Bot\sistema-auth.js")
diff_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-diff-full.txt")
out_path = Path(r"C:\Users\Kalebi\Desktop\GERADO DE NUMERO Para sorteio\sistema-auth-current-precopy.js")

ref_lines = ref_path.read_text(encoding='utf-8').splitlines()
diff_lines = diff_path.read_text(encoding='utf-8').splitlines()

# Apply unified diff from ref->cur to ref lines to reconstruct cur
output_lines = []
ref_idx = 0

hunk_re = re.compile(r'^@@ -(?P<a>\d+),(?P<ac>\d+) \+(?P<b>\d+),(?P<bc>\d+) @@')

line_idx = 0
while line_idx < len(diff_lines) and not diff_lines[line_idx].startswith('@@ '):
    line_idx += 1

while line_idx < len(diff_lines):
    header = diff_lines[line_idx]
    m = hunk_re.match(header)
    if not m:
        raise ValueError(f'Bad hunk header: {header}')
    a = int(m.group('a'))
    ac = int(m.group('ac'))
    b = int(m.group('b'))
    bc = int(m.group('bc'))
    # Copy unchanged lines from ref up to start of hunk
    while ref_idx < a - 1:
        output_lines.append(ref_lines[ref_idx])
        ref_idx += 1
    line_idx += 1
    # Apply hunk
    while line_idx < len(diff_lines) and not diff_lines[line_idx].startswith('@@ '):
        line = diff_lines[line_idx]
        if line.startswith(' '):
            output_lines.append(line[1:])
            ref_idx += 1
        elif line.startswith('-'):
            # line removed from ref in cur
            ref_idx += 1
        elif line.startswith('+'):
            output_lines.append(line[1:])
        elif line.startswith('\\'):
            # diff continue marker e.g. \ No newline at end of file
            pass
        else:
            raise ValueError(f'Unexpected diff line: {line}')
        line_idx += 1

while ref_idx < len(ref_lines):
    output_lines.append(ref_lines[ref_idx])
    ref_idx += 1

out_text = '\n'.join(output_lines) + '\n'
out_path.write_text(out_text, encoding='utf-8')
print(f'RESTORED_PATH={out_path}')
print(f'RESTORED_LINE_COUNT={len(output_lines)}')
print(f'RESTORED_HASH={hashlib.sha256(out_text.encode("utf-8")).hexdigest()}')
