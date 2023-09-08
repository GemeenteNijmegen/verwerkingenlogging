import hashlib
import json


def hashHelper(input):
    # salt = secrets.token_hex(8)
    h = hashlib.new('sha3_256')
    h.update(bytes(input, encoding='UTF-8'))
    # h.update(bytes(salt))
    hash = h.hexdigest()
    return hash

def logApiCall(method, path):
    log = {
        "method": method,
        "path": path,
    }
    print('API CALL: ' + json.dumps(log))