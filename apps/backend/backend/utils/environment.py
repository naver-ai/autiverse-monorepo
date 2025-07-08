from enum import StrEnum
from os import getcwd, getenv, path, makedirs
import re

from dotenv import load_dotenv

class EnvironmentVariables(StrEnum):
    BACKEND_PORT="BACKEND_PORT"
    BACKEND_HOSTNAME="BACKEND_HOSTNAME"
    APP_AUTH_SECRET="AUTH_SECRET"
    OPENAI_API_KEY="OPENAI_API_KEY"
    ADMIN_ID = "ADMIN_ID"
    ADMIN_HASHED_PW = "ADMIN_HASHED_PW"
    CLOVA_CLIENT_ID = "CLOVA_CLIENT_ID"
    CLOVA_CLIENT_SECRET = "CLOVA_CLIENT_SECRET"

def get_env_variable(key: str) -> str:
    env_path = path.join(getcwd(), "../../.env")
    if load_dotenv(env_path):
        if key == EnvironmentVariables.ADMIN_HASHED_PW:
            with open(env_path, 'r') as f:
                for line in f.readlines():
                    match = re.match(r"^ADMIN_HASHED_PW=(\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9\.\/]{53})$", line)
                    if match is not None:
                        return match.group(1)

        return getenv(key)
    else:
        raise ValueError("Could not load dotenv.")
    

class FilePaths:
    __database_dir_path: str = path.join(getcwd(), "../../database")

    dataset_dir_path: str = path.join(getcwd(), "../../data")

    prompt_dir_path: str = path.join(getcwd(), "../../data/prompts")

    users_database_dir_path: str = path.join(__database_dir_path, "users")

    @classmethod
    def get_database_dir_path(cls) -> str:
        if not path.exists(cls.__database_dir_path):
            makedirs(cls.__database_dir_path)
        return cls.__database_dir_path
    
    @classmethod
    def get_database_file_path(cls) -> str:
        return path.join(cls.get_database_dir_path(), "database.db")

    @classmethod
    def get_user_database_dir_path(cls, user_id: str) -> str:
        p = path.join(cls.users_database_dir_path, user_id)
        if not path.exists(p):
            makedirs(p)
        return p
    
    @classmethod
    def get_prompt_file_path(cls, prompt_filename: str) -> str:
        p = path.join(cls.prompt_dir_path, prompt_filename)
        return p