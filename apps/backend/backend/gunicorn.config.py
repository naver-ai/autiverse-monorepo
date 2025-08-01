import os
from os import path, getcwd
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

if(path.exists(path.join(getcwd(), '../../logs')) == False):
    os.makedirs(path.join(getcwd(), '../../logs'))

# Get port from environment variable, default to 3000 if not set
port = os.getenv('BACKEND_PORT', '3000')
bind = f"0.0.0.0:{port}"
workers = 3
proc_name = "autiverse_backend"
reload = False
worker_class = "uvicorn.workers.UvicornWorker"
accesslog=path.join(getcwd(), '../../logs/access.log')
errorlog=path.join(getcwd(), '../../logs/error.log')
capture_output = True

keyfile = os.getenv('PRODUCTION_CERTIFICATE_KEY_PATH', None)
certfile = os.getenv('PRODUCTION_CERTIFICATE_PATH', None)

daemon = True

def on_starting(server):
    print('Started master process of Autiverse backend.')