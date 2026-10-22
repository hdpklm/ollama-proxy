import os
import sys

if len(sys.argv) > 1:
	log_path = sys.argv[1]
else:
	log_path = "LLM_Test/gemini/logs/v0.9.15.txt"

if not os.path.exists(log_path):
	print(f"Error: Log file not found: {log_path}", file=sys.stderr)
	sys.exit(1)

with open(log_path, "r", encoding="utf-8") as f:
	content = f.read().strip()

with open("project_log.md", "a", encoding="utf-8") as f:
	f.write("\n\n" + content)

print(f"OK: Appended {log_path} to project_log.md")
