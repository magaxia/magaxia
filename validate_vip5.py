from html.parser import HTMLParser
from collections import Counter
import re, pathlib, subprocess
path = pathlib.Path('vip5-usuario.html')
text = path.read_text(encoding='utf-8')

class TagParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.open_tags = []
        self.ids = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        self.open_tags.append(tag)
        for k, v in attrs:
            if k == 'id':
                self.ids.append(v)

    def handle_endtag(self, tag):
        if tag not in self.open_tags:
            self.errors.append(f'Extra end tag </{tag}>')
        else:
            for i in range(len(self.open_tags) - 1, -1, -1):
                if self.open_tags[i] == tag:
                    self.open_tags.pop(i)
                    break

parser = TagParser()
parser.feed(text)
print('open_tags_remaining:', parser.open_tags)
print('parser_errors:', parser.errors)
print('duplicate_ids:', [item for item, count in Counter(parser.ids).items() if count > 1])
print('html_count', len(re.findall(r'<\s*html(\s|>|/)', text, re.I)))
print('head_count', len(re.findall(r'<\s*head(\s|>|/)', text, re.I)))
print('body_count', len(re.findall(r'<\s*body(\s|>|/)', text, re.I)))
print('script_count', len(re.findall(r'<\s*script(\s|>|/)', text, re.I)))
print('main_count', len(re.findall(r'<\s*main(\s|>|/)', text, re.I)))
print('section_count', len(re.findall(r'<\s*section(\s|>|/)', text, re.I)))
print('form_count', len(re.findall(r'<\s*form(\s|>|/)', text, re.I)))
print('pad_exists', bool(re.search(r'function\s+pad\s*\(', text)))
print('btn_logout_exists', 'id="btn-logout"' in text)
print('countdown_ids_present', all(x in text for x in ['id="cd-days"', 'id="cd-hours"', 'id="cd-minutes"', 'id="cd-seconds"']))
print('promos_list_exists', 'id="promos-list"' in text)
print('promos_card_exists', 'id="promos-card"' in text)

css_match = re.search(r'<style>(.*?)</style>', text, re.S)
if css_match:
    css = css_match.group(1)
    rules = re.findall(r'([^{}]+){[^}]*}', css)
    selectors = [r.strip() for r in rules]
    dup = [s for s, c in Counter(selectors).items() if c > 1]
    print('css_duplicate_selectors_count', len(dup))
    if dup:
        print('css_duplicates_sample', dup[:20])

script_match = re.search(r'<script[^>]*type=["\"]module["\"][^>]*>(.*?)</script>', text, re.S)
if script_match:
    js = script_match.group(1)
    pathlib.Path('tmp_vip5_usuario_module.js').write_text(js, encoding='utf-8')
    try:
        subprocess.check_output(['node', '--check', 'tmp_vip5_usuario_module.js'], stderr=subprocess.STDOUT, text=True)
        print('node_check', 'ok')
    except subprocess.CalledProcessError as e:
        print('node_check', 'fail')
        print(e.output)
    except FileNotFoundError:
        print('node_check', 'node-not-found')
