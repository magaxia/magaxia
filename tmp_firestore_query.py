import urllib.request
import json
url = 'https://firestore.googleapis.com/v1/projects/vastbitloud-2872a/databases/(default)/documents/produtos_antecipados?key=AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc'
req = urllib.request.Request(url, headers={'Accept':'application/json'})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode('utf-8')
        print('STATUS', r.status)
        print(body[:20000])
except Exception as e:
    print('ERR', type(e).__name__, e)
