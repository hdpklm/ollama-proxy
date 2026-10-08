import asyncio
import queue
import threading
import time
from typing import Optional

from backend.job import DELTA, DONE, ERROR, Job


class Scheduler:
	def __init__(self, engine):
		self.engine = engine
		self.high_queue = queue.Queue()
		self.low_queue = queue.Queue()
		self.current_high: Optional[Job] = None
		self.stream_high = None
		self.current_low: Optional[Job] = None
		self.stream_low = None
		self.running = True
		self.loop: Optional[asyncio.AbstractEventLoop] = None
		self.thread: Optional[threading.Thread] = None

	def submit(self, job: Job):
		if job.priority:
			self.high_queue.put(job)
		else:
			self.low_queue.put(job)

	def cancel(self, job: Job):
		job.cancelled = True

	async def run(self):
		self.loop = asyncio.get_running_loop()
		self.thread = threading.Thread(target=self._token_loop, daemon=True)
		self.thread.start()
		try:
			while self.running:
				await asyncio.sleep(0.5)
		finally:
			self.running = False
			if self.thread and self.thread.is_alive():
				self.thread.join(timeout=1.0)

	def _token_loop(self):
		"""
		Strict Preemptive Token Scheduler:
		Evaluates 1 token per iteration. If a high priority request is active,
		it takes 100% of CPU ticks until completed. Low priority only advances
		when high priority is idle.
		"""
		while self.running:
			# 1. Peticion pendiente (ctx_alta): 100% de los nucleos
			if self.current_high is not None or not self.high_queue.empty():
				if self.current_high is None:
					try:
						self.current_high = self.high_queue.get_nowait()
						self.stream_high = self.engine.create_stream(self.current_high)
					except Exception as err:
						if self.current_high and self.loop:
							self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (ERROR, str(err)))
						self.current_high = None
						self.stream_high = None
						continue

				if self.current_high.cancelled:
					self.current_high = None
					self.stream_high = None
					continue

				try:
					chunk = next(self.stream_high)
					text, finish = self.engine.extract_chunk(self.current_high, chunk)
					if text:
						self.current_high.partial += text
						self.current_high.generated += 1
						if self.loop:
							self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (DELTA, text))

					if finish is not None:
						if self.loop:
							self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (DONE, finish))
						self.current_high = None
						self.stream_high = None
				except StopIteration:
					if self.loop and self.current_high:
						self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (DONE, "stop"))
					self.current_high = None
					self.stream_high = None
				except Exception as err:
					if self.loop and self.current_high:
						self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (ERROR, str(err)))
					self.current_high = None
					self.stream_high = None

			# 2. Peticion pendiente (ctx_baja): Solo entra aqui si alta termino o esta inactiva
			elif self.current_low is not None or not self.low_queue.empty():
				if self.current_low is None:
					try:
						self.current_low = self.low_queue.get_nowait()
						self.stream_low = self.engine.create_stream(self.current_low)
					except Exception as err:
						if self.current_low and self.loop:
							self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (ERROR, str(err)))
						self.current_low = None
						self.stream_low = None
						continue

				if self.current_low.cancelled:
					self.current_low = None
					self.stream_low = None
					continue

				try:
					chunk = next(self.stream_low)
					text, finish = self.engine.extract_chunk(self.current_low, chunk)
					if text:
						self.current_low.partial += text
						self.current_low.generated += 1
						if self.loop:
							self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (DELTA, text))

					if finish is not None:
						if self.loop:
							self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (DONE, finish))
						self.current_low = None
						self.stream_low = None
				except StopIteration:
					if self.loop and self.current_low:
						self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (DONE, "stop"))
					self.current_low = None
					self.stream_low = None
				except Exception as err:
					if self.loop and self.current_low:
						self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (ERROR, str(err)))
					self.current_low = None
					self.stream_low = None

			# 3. Esperar nuevas peticiones HTTP
			else:
				time.sleep(0.01)
