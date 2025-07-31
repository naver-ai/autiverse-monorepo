from contextlib import asynccontextmanager
from os import getcwd, path
from time import perf_counter
import asyncio

from fastapi import FastAPI, Request, Response, status, BackgroundTasks
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.database.engine import create_db_and_tables, engine, initialize_postgres_db
from backend.utils.environment import get_database_type, EnvironmentVariables
from backend.router import admin, app as app_router
from backend.core.socket import socket_app
from re import compile
from backend.database.migrations import migrate

@asynccontextmanager
async def server_lifespan(app: FastAPI):
    print("Server launched.")

    if get_database_type() == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
        initialize_postgres_db()

    migrate()

    await create_db_and_tables(engine)

    # Start resume_generation_tasks in the background

    yield

app = FastAPI(lifespan=server_lifespan)

# Setup routers
app.include_router(admin.router, prefix="/api/v1/admin")
app.include_router(app_router.router, prefix="/api/v1/app")

# Mount Socket.IO app
app.mount('/socket.io', socket_app)

##############

asset_path_regex = compile(r"\.[a-z][a-z0-9]+$")

static_admin_frontend_path = path.join(getcwd(), "../../dist/apps/admin-web")
static_user_frontend_path = path.join(getcwd(), "../../dist/apps/user-web")

# Admin web static files
if path.exists(static_admin_frontend_path):
    @app.get("/admin/{rest_of_path:path}", response_class=HTMLResponse)
    def redirect_admin_frontend(*, rest_of_path: str):
        if len(asset_path_regex.findall(rest_of_path)) > 0:
            return FileResponse(path.join(static_admin_frontend_path, rest_of_path))
        else:
            return HTMLResponse(
                status_code=200,
                content=open(path.join(static_admin_frontend_path, "index.html")).read()
            )

    app.mount("/admin", StaticFiles(directory=static_admin_frontend_path, html=True), name="admin_static")
    print("Admin web static files mounted at /admin")

# User web static files
if path.exists(static_user_frontend_path):
    @app.get("/{rest_of_path:path}", response_class=HTMLResponse)
    def redirect_user_frontend(*, rest_of_path: str):
        if len(asset_path_regex.findall(rest_of_path)) > 0:
            return FileResponse(path.join(static_user_frontend_path, rest_of_path))
        else:
            return HTMLResponse(
                status_code=200,
                content=open(path.join(static_user_frontend_path, "index.html")).read()
            )

    app.mount("/", StaticFiles(directory=static_user_frontend_path, html=True), name="user_static")
    print("User web static files mounted at /")

# Uploaded images static files
uploads_path = path.join(getcwd(), "uploads")
if path.exists(uploads_path):
    app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads_static")
    print("Uploads static files mounted at /uploads")

##############

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    exc_str = f'{exc}'.replace('\n', ' ').replace('   ', ' ')
    # or logger.error(f'{exc}')
    print(request, exc_str)
    content = {'status_code': 10422, 'message': exc_str, 'data': None}
    return JSONResponse(content=content, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)

# Setup middlewares
origins = [
    "http://localhost:3000",
    "localhost:3000",
    "0.0.0.0:3000",
    "http://0.0.0.0:3000",
    "localhost:4200",
    "http://localhost:4200",
    "http://localhost:8000",
    "localhost:8000",
    "0.0.0.0:8888",
    "localhost:8888",
    "http://localhost:8888",
    "http://0.0.0.0:8888",
    "http://localhost:5173",  # Vite dev server
    "localhost:5173",
    "http://127.0.0.1:5173",
    "127.0.0.1:5173",
    "http://localhost:5174",
    "localhost:5174",
    "http://127.0.0.1:5174",
    "127.0.0.1:5174",
    "*"  # Allow all origins for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-processing-time", "X-request-id", "X-context-id", "X-timezone"]
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = perf_counter()
    response = await call_next(request)
    end = perf_counter()
    response.headers["X-processing-time"] = str(end - start)
    return response


@app.middleware("http")
async def pass_request_ids_header(request: Request, call_next):
    response = await call_next(request)

    if "X-request-id" in request.headers:
        response.headers["X-request-id"] = request.headers["x-request-id"]

    if "X-context-id" in request.headers:
        response.headers["X-context-id"] = request.headers["x-context-id"]

    if "X-timezone" in request.headers:
        response.headers["X-timezone"] = request.headers["x-timezone"]

    return response