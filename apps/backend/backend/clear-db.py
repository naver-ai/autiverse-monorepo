import sqlite3

if __name__ == "__main__":
    db_path = './database/database.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 삭제할 테이블 목록
    tables_to_clear = ["comic", "journal", "journalentry", "interactionturn", "message"]

    for table in tables_to_clear:
        cursor.execute(f"DELETE FROM {table};")
        print(f"Cleared table: {table}")

        # Check if sqlite_sequence table exists before trying to reset AUTOINCREMENT
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence';")
        if cursor.fetchone():
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}';")
            print(f"Reset AUTOINCREMENT for: {table}")
        else:
            print(f"No sqlite_sequence table found, skipping AUTOINCREMENT reset for: {table}")

    conn.commit()
    conn.close()

    print("Selected tables have been cleared.")