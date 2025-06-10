from os import path, remove
import questionary
from backend.utils.environment import FilePaths

if __name__ == "__main__":

    if not questionary.confirm("Are you sure you want to delete the database?").ask():
        print("Operation cancelled.")
        exit(0)

    db_path = FilePaths.get_database_file_path()
    if path.exists(db_path):
        remove(db_path)
    print("Database deleted.")



#Just trying git add