from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from core.users.routes import router as users_router
from core.tasks.routes import router as tasks_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("start")
    yield
    print("end")

app = FastAPI(
    title="Simple Todo App Api",
    description="This is a simple Todo app with authentication and task management.",
    version="0.0.1",
    license_info={"name": "MIT"},
    lifespan=lifespan,
)

# Register API routes first
app.include_router(tasks_router)
app.include_router(users_router)

# Frontend directory: ToDo_APP/frontend
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

# Redirect the root URL to the login page
@app.get("/", include_in_schema=False)
async def home():
    return RedirectResponse(url="/login.html")

# Serve frontend files (HTML, CSS, JavaScript)
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)
