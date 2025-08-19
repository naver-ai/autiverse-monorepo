from enum import StrEnum
from os import getcwd, getenv, path, makedirs
import re
from typing import Literal
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

    USE_HTTPS = "USE_HTTPS"
    USE_HTTPS_IN_DEV = "USE_HTTPS_IN_DEV"
    PRODUCTION_CERTIFICATE_PATH = "PRODUCTION_CERTIFICATE_PATH"
    PRODUCTION_CERTIFICATE_KEY_PATH = "PRODUCTION_CERTIFICATE_KEY_PATH"


    DATABASE_TYPE = "DATABASE_TYPE"
    POSTGRES_DB_NAME = "POSTGRES_DB_NAME"
    POSTGRES_USER = "POSTGRES_USER"
    POSTGRES_PASSWORD = "POSTGRES_PASSWORD"

    DATABASE_TYPE_SQLITE = "sqlite"
    DATABASE_TYPE_POSTGRES = "postgres"

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
    

def get_database_type() -> Literal[EnvironmentVariables.DATABASE_TYPE_SQLITE, EnvironmentVariables.DATABASE_TYPE_POSTGRES]:
    return get_env_variable(EnvironmentVariables.DATABASE_TYPE)
    

class FilePaths:
    __database_dir_path: str = path.join(getcwd(), "../../database")

    dataset_dir_path: str = path.join(getcwd(), "../../data")

    prompt_dir_path: str = path.join(getcwd(), "../../data/prompts")

    # i18n 폴더 경로 추가
    i18n_dir_path: str = path.join(getcwd(), "../../data/i18n")

    users_database_dir_path: str = path.join(__database_dir_path, "users")

    # 오디오 파일 저장 디렉토리
    audio_dir_path: str = path.join(getcwd(), "../../audio")

    user_uploads_dir_path: str = path.join(getcwd(), "uploads")


    data_archives_dir_path: str = path.join(getcwd(), "../../data_archives")

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

    @classmethod
    def get_i18n_dir_path(cls) -> str:
        """i18n 폴더 경로 반환"""
        return cls.i18n_dir_path

    @classmethod
    def get_audio_dir_path(cls) -> str:
        """오디오 파일 저장 디렉토리 경로 반환"""
        if not path.exists(cls.audio_dir_path):
            makedirs(cls.audio_dir_path)
        return cls.audio_dir_path
    
    @classmethod
    def get_journal_audio_dir_path(cls, journal_entry_id: str) -> str:
        """특정 journal entry의 오디오 파일 저장 디렉토리 경로 반환"""
        journal_dir = path.join(cls.get_audio_dir_path(), journal_entry_id)
        print(f"[DEBUG] Creating journal audio directory: {journal_dir}")
        try:
            makedirs(journal_dir, exist_ok=True)
            print(f"[DEBUG] Successfully created/verified directory: {journal_dir}")
        except Exception as e:
            print(f"[DEBUG] Error creating directory {journal_dir}: {e}")
            raise
        return journal_dir
    
    @classmethod
    def get_audio_file_path(cls, filename: str) -> str:
        """특정 오디오 파일의 전체 경로 반환"""
        return path.join(cls.get_audio_dir_path(), filename)
    
    @classmethod
    def get_journal_audio_file_path(cls, journal_entry_id: str, filename: str) -> str:
        """특정 journal entry의 오디오 파일 전체 경로 반환"""
        return path.join(cls.get_journal_audio_dir_path(journal_entry_id), filename)
    

    @classmethod
    def get_data_archives_dir_path(cls) -> str:
        if not path.exists(cls.data_archives_dir_path):
            makedirs(cls.data_archives_dir_path)
        return cls.data_archives_dir_path