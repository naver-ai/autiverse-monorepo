import uvicorn
from backend.utils.environment import get_env_variable, EnvironmentVariables

if __name__ == "__main__":
    uvicorn.run("server:app", 
                host="0.0.0.0", 
                port=int(get_env_variable(EnvironmentVariables.BACKEND_PORT)), 
                reload=True)

#Just trying git add