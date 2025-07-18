#!/usr/bin/env python3
"""
Kill Production Server Script

This script safely terminates the gunicorn production server running
with the process name 'autiverse_backend' or on the configured port.
"""

import os
import sys
import signal
import subprocess
import time
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from gunicorn.config.py
PROCESS_NAME = "autihero_backend"
BACKEND_PORT = os.getenv('BACKEND_PORT', '3000')


def find_gunicorn_processes() -> List[dict]:
    """Find all gunicorn processes related to this application."""
    processes = []
    
    try:
        # Method 1: Find by process name
        result = subprocess.run(['pgrep', '-f', PROCESS_NAME], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    processes.append({
                        'pid': int(pid),
                        'method': 'process_name',
                        'name': PROCESS_NAME
                    })
        
        # Method 2: Find by port
        result = subprocess.run(['lsof', '-ti', f':{BACKEND_PORT}'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    pid_int = int(pid)
                    # Check if this PID is not already in our list
                    if not any(p['pid'] == pid_int for p in processes):
                        # Verify it's a gunicorn process
                        cmd_result = subprocess.run(['ps', '-p', pid, '-o', 'comm='], 
                                                  capture_output=True, text=True)
                        if 'gunicorn' in cmd_result.stdout.lower():
                            processes.append({
                                'pid': pid_int,
                                'method': 'port',
                                'port': BACKEND_PORT
                            })
        
        # Method 3: Find by gunicorn command
        result = subprocess.run(['pgrep', '-f', 'gunicorn'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    pid_int = int(pid)
                    # Check if this PID is not already in our list
                    if not any(p['pid'] == pid_int for p in processes):
                        processes.append({
                            'pid': pid_int,
                            'method': 'gunicorn_command',
                            'command': 'gunicorn'
                        })
    
    except Exception as e:
        print(f"Error finding processes: {e}")
    
    return processes


def kill_process(pid: int, method: str, timeout: int = 10) -> bool:
    """Kill a process gracefully, then forcefully if needed."""
    try:
        print(f"Attempting to terminate process {pid} (found by: {method})")
        
        # Send SIGTERM first
        os.kill(pid, signal.SIGTERM)
        
        # Wait for graceful shutdown
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                # Check if process still exists
                os.kill(pid, 0)
                time.sleep(0.5)
            except OSError:
                # Process has terminated
                print(f"Process {pid} terminated gracefully")
                return True
        
        # If still running, force kill
        print(f"Process {pid} did not terminate gracefully, force killing...")
        os.kill(pid, signal.SIGKILL)
        
        # Wait a bit more
        time.sleep(1)
        
        # Final check
        try:
            os.kill(pid, 0)
            print(f"Failed to kill process {pid}")
            return False
        except OSError:
            print(f"Process {pid} force killed successfully")
            return True
            
    except OSError as e:
        print(f"Error killing process {pid}: {e}")
        return False


def kill_all_gunicorn_processes(force: bool = False) -> bool:
    """Kill all found gunicorn processes."""
    processes = find_gunicorn_processes()
    
    if not processes:
        print("No gunicorn processes found")
        return True
    
    print(f"Found {len(processes)} gunicorn process(es):")
    for proc in processes:
        print(f"  PID {proc['pid']} (found by: {proc['method']})")
    
    success = True
    for proc in processes:
        if force:
            # Force kill immediately
            try:
                print(f"Force killing process {proc['pid']}")
                os.kill(proc['pid'], signal.SIGKILL)
                time.sleep(0.5)
                print(f"Process {proc['pid']} force killed")
            except OSError as e:
                print(f"Error force killing process {proc['pid']}: {e}")
                success = False
        else:
            # Graceful kill
            if not kill_process(proc['pid'], proc['method']):
                success = False
    
    return success


def check_server_status() -> bool:
    """Check if the server is still running."""
    processes = find_gunicorn_processes()
    if processes:
        print(f"Server is still running with {len(processes)} process(es):")
        for proc in processes:
            print(f"  PID {proc['pid']}")
        return True
    else:
        print("Server is not running")
        return False


def main():
    """Main function to handle command line arguments."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Kill the production gunicorn server')
    parser.add_argument('--force', '-f', action='store_true', 
                       help='Force kill processes immediately (SIGKILL)')
    parser.add_argument('--status', '-s', action='store_true',
                       help='Check server status only')
    
    args = parser.parse_args()
    
    if args.status:
        check_server_status()
        return
    
    print(f"Killing gunicorn server on port {BACKEND_PORT}...")
    
    if kill_all_gunicorn_processes(force=args.force):
        print("Server termination completed successfully")
        
        # Final status check
        if not check_server_status():
            print("✅ All gunicorn processes have been terminated")
        else:
            print("⚠️  Some processes may still be running")
            sys.exit(1)
    else:
        print("❌ Failed to terminate some processes")
        sys.exit(1)


if __name__ == "__main__":
    main() 