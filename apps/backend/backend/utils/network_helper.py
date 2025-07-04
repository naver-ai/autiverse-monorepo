import requests
import os
from typing import Dict, Any, Optional
from .environment import get_env_variable, EnvironmentVariables

class NetworkHelper:
    """Backend NetworkHelper for internal API communication"""
    
    @staticmethod
    def get_base_url() -> str:
        """Get base URL from environment or default to localhost"""
        try:
            hostname = get_env_variable(EnvironmentVariables.BACKEND_HOSTNAME)
            port = get_env_variable(EnvironmentVariables.BACKEND_PORT)
            return f"http://{hostname}:{port}"
        except:
            # Fallback to localhost if env vars not set
            return "http://localhost:3000"
    
    @staticmethod
    def get_internal_client(base_url: str = None):
        """Get internal requests session for backend-to-backend communication"""
        if base_url is None:
            base_url = NetworkHelper.get_base_url()
        
        session = requests.Session()
        session.headers.update({
            'Content-Type': 'application/json',
        })
        return session, base_url
    
    @staticmethod
    def get_comic_generation_endpoints(base_url: str = None):
        """Get comic generation endpoints"""
        if base_url is None:
            base_url = NetworkHelper.get_base_url()
        
        return {
            'START': f'{base_url}/api/v1/app/comic-generation/start',
            'getStatusEndpoint': lambda journal_entry_id: f'{base_url}/api/v1/app/comic-generation/status/{journal_entry_id}',
            'getCancelEndpoint': lambda journal_entry_id: f'{base_url}/api/v1/app/comic-generation/cancel/{journal_entry_id}',
        }
    
    @staticmethod
    def make_internal_request(method: str, url: str, data: Optional[Dict[str, Any]] = None, **kwargs):
        """Make internal HTTP request"""
        session, _ = NetworkHelper.get_internal_client()
        
        if method.upper() == 'GET':
            response = session.get(url, **kwargs)
        elif method.upper() == 'POST':
            response = session.post(url, json=data, **kwargs)
        elif method.upper() == 'PUT':
            response = session.put(url, json=data, **kwargs)
        elif method.upper() == 'DELETE':
            response = session.delete(url, **kwargs)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        return response 