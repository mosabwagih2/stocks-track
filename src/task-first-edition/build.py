# Rebuilds apps/task-first-edition/index.html from the source file and the data.
# Run from the repository root: python3 src/task-first-edition/build.py
import pathlib
r = pathlib.Path(__file__).parent
src = (r / 'app.src.html').read_text(encoding='utf-8')
data = (r / 'data.json').read_text(encoding='utf-8')
out = r.parent.parent / 'apps' / 'task-first-edition' / 'index.html'
out.write_text(src.replace('__DATA__', data), encoding='utf-8')
print('built', out)
