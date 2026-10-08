import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.engine import LlamaEngine
from backend.routes import api_router, router
from backend.scheduler import Scheduler


@asynccontextmanager
async def lifespan(app):
	engine = LlamaEngine()
	scheduler = Scheduler(engine)
	worker = asyncio.create_task(scheduler.run())
	app.state.engine = engine
	app.state.scheduler = scheduler
	yield
	worker.cancel()


app = FastAPI(lifespan=lifespan)
app.include_router(router)
app.include_router(api_router)
