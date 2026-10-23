import json
import time
import re
from typing import Optional, Any

try:
	import redis.asyncio as aioredis
except ImportError:
	aioredis = None

from config import settings

class TreeNode:
	def __init__(self, name: str, data: Optional[str] = None):
		self.name = name
		self.data = data
		self.children: dict[str, "TreeNode"] = {}
		self.updated_at = time.time()

	def add_path(self, path: list[str], data: Optional[str] = None) -> "TreeNode":
		curr = self
		for segment in path:
			clean_seg = segment.strip()
			if not clean_seg:
				continue
			if clean_seg not in curr.children:
				curr.children[clean_seg] = TreeNode(clean_seg)
			curr = curr.children[clean_seg]
			curr.updated_at = time.time()
		if data is not None:
			curr.data = data
		return curr

	def to_dict(self) -> dict:
		return {
			"name": self.name,
			"data": self.data,
			"updated_at": self.updated_at,
			"children": {k: v.to_dict() for k, v in self.children.items()}
		}

	@classmethod
	def from_dict(cls, d: dict) -> "TreeNode":
		node = cls(d.get("name", "root"), data=d.get("data"))
		node.updated_at = d.get("updated_at", time.time())
		for k, child_d in d.get("children", {}).items():
			node.children[k] = cls.from_dict(child_d)
		return node

class TreeContextManager:
	def __init__(self, redis_url: str = settings.REDIS_URL):
		self.redis_url = redis_url
		self.client: Any = None
		self._memory_branches: dict[str, dict] = {}
		self._redis_prefix = "rag:tree:branch:"

	async def _get_client(self) -> Any:
		if self.client is None and self.redis_url and aioredis:
			try:
				self.client = aioredis.from_url(
					self.redis_url,
					decode_responses=True,
					socket_connect_timeout=2.0
				)
				await self.client.ping()
			except Exception:
				self.client = None
		return self.client

	async def get_or_create_branch(self, branch_id: str, name: str = "Principal") -> dict:
		client = await self._get_client()
		if client:
			try:
				raw = await client.get(f"{self._redis_prefix}{branch_id}")
				if raw:
					data = json.loads(raw)
					data["tree"] = TreeNode.from_dict(data.get("tree", {}))
					return data
			except Exception:
				pass

		if branch_id in self._memory_branches:
			return self._memory_branches[branch_id]

		branch_data = {
			"id": branch_id,
			"name": name,
			"messages": [],
			"tree": TreeNode(name="root"),
			"active_topic": None,
			"turn_counter": 0,
			"updated_at": time.time()
		}
		self._memory_branches[branch_id] = branch_data
		return branch_data

	async def save_branch(self, branch_data: dict):
		branch_id = branch_data["id"]
		branch_data["updated_at"] = time.time()
		self._memory_branches[branch_id] = branch_data

		client = await self._get_client()
		if client:
			try:
				serialized = {
					**branch_data,
					"tree": branch_data["tree"].to_dict()
				}
				await client.set(f"{self._redis_prefix}{branch_id}", json.dumps(serialized), ex=86400 * 30)
			except Exception:
				pass

	def _denoise_messages(self, messages: list[dict]) -> list[dict]:
		clean_messages = []
		noise_patterns = [
			r"^\s*(\d+\s*[\+\-\*\/xX]\s*\d+\s*=?|\d+)\s*$", # Isolated math calculation like 5x7
			r"^\s*(gracias|ok|vale|hola|adios|bye|thx)\s*$"
		]
		for msg in messages:
			content = msg.get("content", "").strip()
			is_noise = False
			for pat in noise_patterns:
				if re.match(pat, content, re.IGNORECASE):
					is_noise = True
					break
			if not is_noise:
				clean_messages.append(msg)
		return clean_messages

	async def add_turn(self, branch_id: str, user_content: str, assistant_content: str, auto_topic: Optional[str] = None):
		branch = await self.get_or_create_branch(branch_id)
		branch["messages"].append({"role": "user", "content": user_content})
		branch["messages"].append({"role": "assistant", "content": assistant_content})
		branch["turn_counter"] = branch.get("turn_counter", 0) + 1

		if auto_topic:
			branch["active_topic"] = auto_topic.strip().lower()

		# Strict 10-message sliding window (5 user turns + 5 assistant turns)
		if len(branch["messages"]) > 10:
			branch["messages"] = branch["messages"][-10:]

		# Denoising routine every 5 turns
		if branch["turn_counter"] % 5 == 0:
			branch["messages"] = self._denoise_messages(branch["messages"])

		await self.save_branch(branch)

	async def archive_to_tree(
		self,
		branch_id: str,
		topic: str,
		subtopic: str,
		detail: str,
		data: Optional[str] = None
	):
		branch = await self.get_or_create_branch(branch_id)
		tree: TreeNode = branch["tree"]
		tree.add_path([topic.strip().lower(), subtopic.strip().lower(), detail.strip().lower()], data=data)
		branch["active_topic"] = topic.strip().lower()
		await self.save_branch(branch)

	def detect_active_topic(self, branch_data: dict, query: str = "") -> Optional[str]:
		tree: TreeNode = branch_data["tree"]
		available_topics = list(tree.children.keys())
		if not available_topics:
			return branch_data.get("active_topic")

		query_lower = query.lower()
		for topic in available_topics:
			if topic in query_lower:
				branch_data["active_topic"] = topic
				return topic

			for subtopic in tree.children[topic].children.keys():
				if subtopic in query_lower:
					branch_data["active_topic"] = topic
					return topic

		return branch_data.get("active_topic") or (available_topics[0] if available_topics else None)

	async def project_context(self, branch_id: str, current_query: str = "") -> str:
		branch = await self.get_or_create_branch(branch_id)
		tree: TreeNode = branch["tree"]
		if not tree.children:
			return ""

		active_topic = self.detect_active_topic(branch, current_query)

		lines = ["[datos en RAG]:"]
		for topic_name, topic_node in tree.children.items():
			is_active = (active_topic and topic_name == active_topic)
			if is_active:
				lines.append(f"- {topic_name}:")
				for sub_name, sub_node in topic_node.children.items():
					lines.append(f"  - {sub_name}:")
					for detail_name, detail_node in sub_node.children.items():
						detail_val = f" ({detail_node.data})" if detail_node.data else ""
						lines.append(f"    -- {detail_name}{detail_val}")
			else:
				child_names = list(topic_node.children.keys())
				if child_names:
					lines.append(f"- {topic_name}: {', '.join(child_names)}")
				else:
					lines.append(f"- {topic_name}")

		return "\n".join(lines)

	async def fork_branch(self, source_branch_id: str, new_branch_id: str, new_name: str = "") -> dict:
		source = await self.get_or_create_branch(source_branch_id)
		new_branch = {
			"id": new_branch_id,
			"name": new_name or f"{source.get('name', 'Rama')} (Copia)",
			"messages": list(source.get("messages", [])),
			"tree": TreeNode.from_dict(source.get("tree", TreeNode("root")).to_dict()),
			"active_topic": source.get("active_topic"),
			"turn_counter": source.get("turn_counter", 0),
			"updated_at": time.time()
		}
		await self.save_branch(new_branch)
		return new_branch
