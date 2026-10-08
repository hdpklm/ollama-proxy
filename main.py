import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from backend.routes import router
from backend.scheduler import Scheduler


@asynccontextmanager
async def lifespan(app):
	client = httpx.AsyncClient(timeout=httpx.Timeout(None))
	scheduler = Scheduler(client)
	worker = asyncio.create_task(scheduler.run())
	app.state.client = client
	app.state.scheduler = scheduler
	yield
	worker.cancel()
	await client.aclose()


app = FastAPI(lifespan=lifespan)
app.include_router(router)
