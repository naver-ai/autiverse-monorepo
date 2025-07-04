import requests
from typing import Dict, Any, Optional

class NetworkHelper:
    """Backend NetworkHelper for internal API communication"""
    
    @staticmethod
    # 나중에는 Env에서 base_url 가져오기
    # base_url = os.getenv('BACKEND_BASE_URL')
    def get_internal_client(base_url: str = "http://localhost:3000"):
        """Get internal requests session for backend-to-backend communication"""
        session = requests.Session()
        session.headers.update({
            'Content-Type': 'application/json',
        })
        return session, base_url
    
    @staticmethod
    # 나중에는 Env에서 base_url 가져오기
    # base_url = os.getenv('BACKEND_BASE_URL')
    def get_comic_generation_endpoints(base_url: str = "http://localhost:3000"):
        """Get comic generation endpoints"""
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