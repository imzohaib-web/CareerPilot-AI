"""Temporary fix helper: repairs the mangled test line and scans for residue."""

# 1. Fix the mangled test line (Korean chars left where think tags were eaten).
path = 'tests/test_resume.py'
src = open(path, encoding='utf-8').read()
old = "        text = ' \uc704\ud574 {\"bogus\": 1}\\n{\"score\": 50}'"
new = (
    "        # Tags built by concatenation so tooling cannot strip them as markup.\n"
    "        think_open = \"<\" + \"think\" + \">\"\n"
    "        think_close = \"<\" + \"/think\" + \">\"\n"
    "        text = think_open + ' {\"bogus\": 1}' + think_close + '\\n{\"score\": 50}'"
)
if old in src:
    src = src.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(src)
    print('test_resume.py: mangled line replaced')
else:
    print('test_resume.py: target line NOT found (already fixed?)')

# 2. Scan edited files for leftover Hangul or stray think-tag fragments.
files = [
    'app/services/ai/json_utils.py',
    'app/services/ai/qwen_service.py',
    'app/services/ai/resume_analyzer.py',
    'app/services/skill_gap_service.py',
    'app/services/roadmap_service.py',
    'app/services/interview_service.py',
    'app/routes/resume.py',
    'tests/test_resume.py',
    'tests/test_qwen_service.py',
]
for f in files:
    content = open(f, encoding='utf-8').read()
    hangul = [ch for ch in content if 0xAC00 <= ord(ch) <= 0xD7A3]
    # Open tag without matching close or vice versa would show as '<think' or '</think'
    has_open = '<' + 'think' + '>' in content
    has_close = '<' + '/think' + '>' in content
    print(f'{f}: hangul={len(hangul)} open_tag={has_open} close_tag={has_close}')
