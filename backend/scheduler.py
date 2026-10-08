import asyncio
import heapq
import itertools

from backend.job import DELTA, DONE, ERROR
from backend.upstream import stream_events


class Scheduler:
	def __init__(self, client):
		self.client = client
		self.heap = []
		self.current = None
		self.counter = itertools.count()
		self.wake = asyncio.Event()
		self.preempt = asyncio.Event()

	def submit(self, job):
		job.seq = next(self.counter)
		self._push(job)
		if job.priority and self.current and not self.current.priority:
			self.preempt.set()

	def cancel(self, job):
		job.cancelled = True
		if self.current is job:
			self.preempt.set()

	async def run(self):
		while True:
			job = await self._next()
			self.current = job
			self.preempt.clear()
			try:
				await self._execute(job)
			finally:
				self.current = None

	def _push(self, job):
		rank = 0 if job.priority else 1
		heapq.heappush(self.heap, (rank, job.seq, job))
		self.wake.set()

	async def _next(self):
		while True:
			while self.heap:
				_, _, job = heapq.heappop(self.heap)
				if not job.cancelled:
					return job
			self.wake.clear()
			await self.wake.wait()

	async def _execute(self, job):
		task = asyncio.create_task(self._consume(job))
		stop = asyncio.create_task(self.preempt.wait())
		await asyncio.wait({task, stop}, return_when=asyncio.FIRST_COMPLETED)
		stop.cancel()
		if task.done():
			return

		task.cancel()
		await asyncio.gather(task, return_exceptions=True)
		if not job.cancelled:
			self._push(job)

	async def _consume(self, job):
		try:
			async for text, finish in stream_events(self.client, job):
				if text:
					job.partial += text
					job.generated += 1
					job.out.put_nowait((DELTA, text))
				if finish:
					job.out.put_nowait((DONE, finish))
					return
			job.out.put_nowait((DONE, "stop"))
		except Exception as error:
			job.out.put_nowait((ERROR, str(error) or repr(error)))
