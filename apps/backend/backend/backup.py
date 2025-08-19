import os
import shutil
import zipfile
import tempfile
import subprocess
import argparse
from datetime import datetime
import questionary
from backend.utils.environment import FilePaths, get_database_type, EnvironmentVariables, get_env_variable

def dump_data() -> tuple[str, str]:
    """
    Creates a complete data dump including database and dyads directory.
    
    Returns:
        str: Absolute path of the created zip file
    """
    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    dump_dir = os.path.join(temp_dir, "autiverse_dump")
    os.makedirs(dump_dir, exist_ok=True)
    
    # Create directory structure
    db_dir = os.path.join(dump_dir, "db")
    files_dir = os.path.join(dump_dir, "files")
    audio_dir = os.path.join(files_dir, "audio")
    uploads_dir = os.path.join(files_dir, "uploads")
    
    os.makedirs(db_dir, exist_ok=True)
    os.makedirs(audio_dir, exist_ok=True)
    os.makedirs(uploads_dir, exist_ok=True)
    
    try:
        # 1. Create database dump
        database_type = get_database_type()
        
        if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE:
            # SQLite: Copy file
            db_file_path = FilePaths.get_database_file_path()
            if os.path.exists(db_file_path):
                db_dump_path = os.path.join(db_dir, "database.db")
                shutil.copy2(db_file_path, db_dump_path)
                print(f"✅ SQLite database copied to: {db_dump_path}")
            else:
                print("⚠️ SQLite database file not found")
                
        elif database_type == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
            # PostgreSQL: Use pg_dump
            db_name = get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)
            db_user = get_env_variable(EnvironmentVariables.POSTGRES_USER)
            db_password = get_env_variable(EnvironmentVariables.POSTGRES_PASSWORD)
            
            db_dump_path = os.path.join(db_dir, "database.sql")
            
            # Execute pg_dump command
            env = os.environ.copy()
            env['PGPASSWORD'] = db_password
            
            try:
                result = subprocess.run([
                    'pg_dump',
                    '-h', 'localhost',
                    '-U', db_user,
                    '-d', db_name,
                    '-f', db_dump_path,
                    '--no-password'
                ], env=env, capture_output=True, text=True, check=True)
                print(f"✅ PostgreSQL database dumped to: {db_dump_path}")
            except subprocess.CalledProcessError as e:
                print(f"❌ PostgreSQL dump failed: {e.stderr}")
                raise
            except FileNotFoundError:
                print("❌ pg_dump command not found. Please install PostgreSQL client tools.")
                raise
        
        # 2. Copy dyads directory to users
        if os.path.exists(FilePaths.user_uploads_dir_path):
            shutil.copytree(FilePaths.user_uploads_dir_path, uploads_dir, dirs_exist_ok=True)
            print(f"✅ Uploads directory copied to: {uploads_dir}")
        else:
            print("⚠️ Uploads directory not found")

        # 3. Copy audio directory to audio directory
        if os.path.exists(FilePaths.get_audio_dir_path()):
            shutil.copytree(FilePaths.get_audio_dir_path(), audio_dir, dirs_exist_ok=True)
            print(f"✅ Audio directory copied to: {audio_dir}")
        else:
            print("⚠️ Audio directory not found")
        
        # 3. Create metadata file
        metadata = {
            "dump_created_at": datetime.now().isoformat(),
            "database_type": database_type,
            "source_paths": {
                "database": FilePaths.get_database_file_path() if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE else f"postgresql://{get_env_variable(EnvironmentVariables.POSTGRES_USER)}@localhost:5432/{get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)}",
                "uploads_directory": FilePaths.user_uploads_dir_path,
                "audio_directory": FilePaths.get_audio_dir_path()
            }
        }
        
        import json
        metadata_path = os.path.join(db_dir, "metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        print(f"✅ Metadata file created: {metadata_path}")
        
        # 4. Create zip file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"autiverse_dump_{timestamp}.zip"
                
        # Create zip file in data_archives directory
        zip_path = os.path.join(FilePaths.get_data_archives_dir_path(), zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(dump_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, dump_dir)
                    zipf.write(file_path, arcname)
        
        print(f"✅ Data dump created: {zip_path}")
        
        # Clean up temporary directory
        shutil.rmtree(temp_dir)
        
        return str(zip_filename), str(zip_path)
        
    except Exception as e:
        # Clean up temporary directory on error
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        print(f"❌ Data dump failed: {str(e)}")
        raise


def restore_data(dump_file_path: str, skip_confirmation: bool = False):
    """
    Restores data from a dump file.
    
    Args:
        dump_file_path (str): Path to the dump file to restore from
        skip_confirmation (bool): Skip confirmation prompt (for non-interactive use)
    """
    if not os.path.exists(dump_file_path):
        raise FileNotFoundError(f"Dump file not found: {dump_file_path}")
    
    # Create temporary directory for extraction
    temp_dir = tempfile.mkdtemp()
    
    try:
        print(f"📦 Extracting dump file: {dump_file_path}")
        
        # Extract zip file
        with zipfile.ZipFile(dump_file_path, 'r') as zipf:
            zipf.extractall(temp_dir)
        
        # List contents of temp_dir to debug
        print(f"📁 Contents of temp_dir ({temp_dir}):")
        for item in os.listdir(temp_dir):
            item_path = os.path.join(temp_dir, item)
            if os.path.isdir(item_path):
                print(f"   📂 {item}/")
                # List contents of subdirectory
                try:
                    for subitem in os.listdir(item_path):
                        subitem_path = os.path.join(item_path, subitem)
                        if os.path.isdir(subitem_path):
                            print(f"      📂 {subitem}/")
                        else:
                            print(f"      📄 {subitem}")
                except Exception as e:
                    print(f"      ❌ Error listing {item}: {e}")
            else:
                print(f"   📄 {item}")
        
        # Check if we have the expected structure directly in temp_dir
        db_dir = os.path.join(temp_dir, "db")
        files_dir = os.path.join(temp_dir, "files")
        
        if os.path.exists(db_dir) and os.path.exists(files_dir):
            print(f"✅ Found expected directory structure in temp_dir")
            dump_dir = temp_dir
        else:
            # Try to find autiverse_dump directory (for backward compatibility)
            dump_dir = os.path.join(temp_dir, "autiverse_dump")
            print(f"🔍 Looking for dump_dir: {dump_dir}")
            if not os.path.exists(dump_dir):
                # Try to find the correct directory structure
                possible_dirs = []
                for root, dirs, files in os.walk(temp_dir):
                    for dir_name in dirs:
                        if "autiverse" in dir_name.lower() or "dump" in dir_name.lower():
                            possible_dirs.append(os.path.join(root, dir_name))
                
                if possible_dirs:
                    print(f"🔍 Found possible dump directories: {possible_dirs}")
                    # Use the first one found
                    dump_dir = possible_dirs[0]
                    print(f"✅ Using found directory: {dump_dir}")
                else:
                    raise ValueError(f"Invalid dump file structure. Expected 'db' and 'files' directories not found in {temp_dir}")
        
        # Read metadata
        metadata_path = os.path.join(dump_dir, "db", "metadata.json")
        if not os.path.exists(metadata_path):
            raise ValueError("Metadata file not found in dump")
        
        import json
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        print(f"📋 Restoring data from dump created at: {metadata['dump_created_at']}")
        print(f"🗄️ Database type: {metadata['database_type']}")
        
        # Show confirmation prompt
        if not skip_confirmation:
            print("\n⚠️  WARNING: This operation will:")
            print("   - Replace the current database with the dump data")
            print("   - Replace the current uploads directory with the dump data")
            print("   - Replace the current audio directory with the dump data")
            print("   - Create backups of existing data before replacement")
            
            # Get current database and dyads info
            current_db_path = FilePaths.get_database_file_path() if get_database_type() == EnvironmentVariables.DATABASE_TYPE_SQLITE else "PostgreSQL database"
            current_uploads_path = FilePaths.user_uploads_dir_path
            current_audio_path = FilePaths.get_audio_dir_path()
            
            print(f"\n📊 Current data locations:")
            print(f"   - Database: {current_db_path}")
            print(f"   - Uploads directory: {current_uploads_path}")
            print(f"   - Audio directory: {current_audio_path}")
            
            # Ask for confirmation
            answer = questionary.confirm(
                "Are you sure you want to proceed with the data restoration?",
                default=False
            ).ask()
            
            if not answer:
                print("❌ Data restoration cancelled by user")
                return
        
        # 1. Restore database
        database_type = metadata['database_type']
        
        if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE:
            # SQLite: Copy file
            db_dump_path = os.path.join(dump_dir, "db", "database.db")
            if os.path.exists(db_dump_path):
                db_file_path = FilePaths.get_database_file_path()
                
                # Backup existing database if it exists
                if os.path.exists(db_file_path):
                    backup_path = f"{db_file_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    shutil.copy2(db_file_path, backup_path)
                    print(f"💾 Existing database backed up to: {backup_path}")
                
                # Copy new database
                shutil.copy2(db_dump_path, db_file_path)
                print(f"✅ SQLite database restored to: {db_file_path}")
            else:
                print("⚠️ SQLite database file not found in dump")
                
        elif database_type == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
            # PostgreSQL: Use psql to restore
            db_name = get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)
            db_user = get_env_variable(EnvironmentVariables.POSTGRES_USER)
            db_password = get_env_variable(EnvironmentVariables.POSTGRES_PASSWORD)
            
            db_dump_path = os.path.join(dump_dir, "db", "database.sql")
            
            if os.path.exists(db_dump_path):
                # Execute psql command to restore
                env = os.environ.copy()
                env['PGPASSWORD'] = db_password
                
                try:
                    # Drop and recreate database
                    print("🗑️ Dropping existing database...")
                    subprocess.run([
                        'psql',
                        '-h', 'localhost',
                        '-U', db_user,
                        '-d', 'postgres',
                        '-c', f'DROP DATABASE IF EXISTS {db_name};'
                    ], env=env, capture_output=True, text=True, check=True)
                    
                    print("🆕 Creating new database...")
                    subprocess.run([
                        'psql',
                        '-h', 'localhost',
                        '-U', db_user,
                        '-d', 'postgres',
                        '-c', f'CREATE DATABASE {db_name};'
                    ], env=env, capture_output=True, text=True, check=True)
                    
                    print("📥 Restoring database from dump...")
                    subprocess.run([
                        'psql',
                        '-h', 'localhost',
                        '-U', db_user,
                        '-d', db_name,
                        '-f', db_dump_path
                    ], env=env, capture_output=True, text=True, check=True)
                    
                    print(f"✅ PostgreSQL database restored successfully")
                except subprocess.CalledProcessError as e:
                    print(f"❌ PostgreSQL restore failed: {e.stderr}")
                    raise
                except FileNotFoundError:
                    print("❌ psql command not found. Please install PostgreSQL client tools.")
                    raise
            else:
                print("⚠️ PostgreSQL dump file not found in dump")
        
        # 2. Restore uploads directory
        uploads_dir = os.path.join(dump_dir, "files", "uploads")
        if os.path.exists(uploads_dir):
            uploads_target_path = FilePaths.user_uploads_dir_path
            
            # Backup existing uploads directory if it exists
            if os.path.exists(uploads_target_path):
                backup_path = f"{uploads_target_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copytree(uploads_target_path, backup_path)
                print(f"💾 Existing uploads directory backed up to: {backup_path}")
                
                # Remove existing directory
                shutil.rmtree(uploads_target_path)
            
            # Copy new uploads directory
            shutil.copytree(uploads_dir, uploads_target_path)
            print(f"✅ Uploads directory restored to: {uploads_target_path}")
        else:
            print("⚠️ Uploads directory not found in dump")
        
        # 3. Restore audio directory
        
        audio_dir = os.path.join(dump_dir, "files", "audio")
        if os.path.exists(audio_dir):
            audio_target_path = FilePaths.get_audio_dir_path()
            
            # Backup existing audio directory if it exists
            if os.path.exists(audio_target_path):
                backup_path = f"{audio_target_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copytree(audio_target_path, backup_path, dirs_exist_ok=True)
                print(f"💾 Existing audio directory backed up to: {backup_path}")
                
                # Remove existing directory
                shutil.rmtree(audio_target_path)
                
                # Copy new audio directory
                shutil.copytree(audio_dir, audio_target_path, dirs_exist_ok=True)
                print(f"✅ Audio directory restored to: {audio_target_path}")
        else:
            print("⚠️ Audio directory not found in dump")
        
        print("🎉 Data restoration completed successfully!")
        
    except Exception as e:
        print(f"❌ Data restoration failed: {str(e)}")
        raise
    finally:
        # Clean up temporary directory
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Autiverse Data Backup and Restore Tool')
    parser.add_argument('--dump', action='store_true', help='Create a data dump')
    parser.add_argument('--restore', type=str, help='Restore data from dump file path')
    parser.add_argument('--skip-confirmation', action='store_true', help='Skip confirmation prompt for restore operation')
    
    args = parser.parse_args()
    
    if args.dump and args.restore:
        print("❌ Cannot use --dump and --restore at the same time")
        exit(1)
    
    if not args.dump and not args.restore:
        print("❌ Please specify either --dump or --restore")
        parser.print_help()
        exit(1)
    
    try:
        if args.dump:
            # Create data dump
            dump_path = dump_data()
            print(f"🎉 Data dump completed successfully!")
            print(f"📁 Dump file location: {dump_path}")
        elif args.restore:
            # Restore data from dump
            restore_data(args.restore, skip_confirmation=args.skip_confirmation)
            print(f"🎉 Data restoration completed successfully!")
    except Exception as e:
        print(f"💥 Operation failed: {e}")
        exit(1)