import os

log_path = "LLM_Test/gemini/logs/v0.9.14.txt"
with open(log_path, "r", encoding="utf-8") as f:
	content = f.read().strip()

with open("project_log.md", "a", encoding="utf-8") as f:
	f.write("\n\n" + content)
print("OK")
