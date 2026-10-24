import os
import hashlib
import yaml

def parse_yaml_fallback(yaml_text: str) -> dict:
	metadata = {}
	current_section = None
	current_tool = None
	current_key = None

	for raw_line in yaml_text.splitlines():
		line = raw_line.rstrip()
		if not line or line.startswith("#"):
			continue
		indent = len(raw_line) - len(raw_line.lstrip(" "))
		stripped = line.strip()

		if indent == 0 and ":" in stripped:
			k, v = stripped.split(":", 1)
			k, v = k.strip(), v.strip().strip('"\'')
			current_section = k
			current_tool = None
			current_key = None
			if k == "tools":
				metadata["tools"] = {}
			else:
				metadata[k] = float(v) if v.replace(".", "", 1).isdigit() else v
		elif indent == 2 and current_section == "tools" and ":" in stripped:
			tool_name = stripped.split(":", 1)[0].strip()
			current_tool = tool_name
			current_key = None
			metadata["tools"][tool_name] = {}
		elif indent == 4 and current_tool and ":" in stripped:
			k, v = stripped.split(":", 1)
			k, v = k.strip(), v.strip().strip('"\'')
			current_key = k
			if k == "rules":
				metadata["tools"][current_tool]["rules"] = []
			elif k == "max_calls":
				metadata["tools"][current_tool]["max_calls"] = int(v) if v.isdigit() else v
			elif k == "purpose":
				metadata["tools"][current_tool]["purpose"] = v
			else:
				metadata["tools"][current_tool][k] = v
		elif indent >= 6 and current_tool and current_key == "rules" and stripped.startswith("-"):
			rule_text = stripped[1:].strip().strip('"\'')
			metadata["tools"][current_tool]["rules"].append(rule_text)

	return metadata

def test():
	for fn in ["system_prompt.md", "researcher.md", "coder.md", "writer.md"]:
		p = os.path.join("prompts", fn)
		if not os.path.exists(p):
			continue
		with open(p, "r", encoding="utf-8") as f:
			parts = f.read().split("---")
			if len(parts) >= 3:
				y_txt = parts[1]
				py_res = yaml.safe_load(y_txt)
				fb_res = parse_yaml_fallback(y_txt)
				assert py_res.get("tools") == fb_res.get("tools"), f"Mismatch in {fn}:\nPY: {py_res.get('tools')}\nFB: {fb_res.get('tools')}"
				print(f"Verified tools equality for {fn}: OK")

if __name__ == "__main__":
	test()
