import requests
url='http://127.0.0.1:8080/v1/projects/vastbitloud-2872a/databases/(default)/documents/vip5_gerador_codigos'
r=requests.get(url, timeout=10)
print('STATUS', r.status_code)
print(r.text[:2000])
