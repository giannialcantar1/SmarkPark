content = open('routes/access_codes.py', 'r', encoding='utf-8').read()
old = '"Código inválido, vencido o ya utilizado"}), 404'
new = '"Código inválido, vencido o ya utilizado"}), 400'
if old in content:
    content = content.replace(old, new)
    open('routes/access_codes.py', 'w', encoding='utf-8').write(content)
    print('Fixed: Changed 404 to 400 for invalid/expired codes')
else:
    print('Pattern not found, checking...')
    # Try alternative patterns
    import re
    matches = re.findall(r'"Código inválido[^"]*"\), \d+', content)
    print('Found:', matches)
