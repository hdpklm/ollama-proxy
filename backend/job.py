import asyncio
import time
import uuid
from dataclasses import dataclass, field

CHAT = "chat"
COMPLETION = "completion"

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
	partial: str = ""
	generated: int = 0
	cancelled: bool = False
	out: asyncio.Queue = field(default_factory=asyncio.Queue)
