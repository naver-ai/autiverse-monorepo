import uvicorn
import os
from backend.utils.environment import get_env_variable, EnvironmentVariables
from os import getcwd, path

if __name__ == "__main__":

    os.environ['TZ'] = 'Asia/Seoul'

    if get_env_variable(EnvironmentVariables.USE_HTTPS_IN_DEV) == "1":
        ssl_certfile_path = path.join(getcwd(), '../../localhost.pem')
        ssl_keyfile_path = path.join(getcwd(), '../../localhost-key.pem')
    else:
        ssl_certfile_path = None
        ssl_keyfile_path = None

    uvicorn.run("server:app", 
                host="0.0.0.0", 
                port=int(get_env_variable(EnvironmentVariables.BACKEND_PORT)), 
                reload=True,
                ssl_certfile=ssl_certfile_path,
                ssl_keyfile=ssl_keyfile_path)

#Just trying git add