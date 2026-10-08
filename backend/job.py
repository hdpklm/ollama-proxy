import asyncio
import time
import uuid
from dataclasses import dataclass, field

CHAT = "chat"
COMPLETION = "completion"
GENERATE = "generate"

DELTA = "delta"
DONE = "done"
ERROR = "error"


@dataclass
class Job:
	kind: str
	body: dict
	priority: bool
	stream: bool
	id: str = field(default_factory=lambda: uuid.uuid4().hex)
	created: int = field(default_factory=lambda: int(time.time()))
	seq: int = 0
	prompt: str = ""
	partial: str = ""
	generated: int = 0
	cancelled: bool = False
	times_paused: int = 0
	kv_cache_ram_mb: float = 0.0
	prompt_tokens: int = 0
	prompt_eval_seconds: float = 0.0
	prompt_tps: float = 0.0
	generation_seconds: float = 0.0
	generation_tps: float = 0.0
	t_start: float = field(default_factory=time.time)
	t_first_token: float = 0.0
	out: asyncio.Queue = field(default_factory=asyncio.Queue)
