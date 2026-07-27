import requests as reqs
from typing import Any
import json
import re
from game_client.config import Config
from gamuLogger import Logger

CONF = Config()


ENFORCE_HTTPS : bool = CONF.enforce_https
if not ENFORCE_HTTPS:
    Logger.warning("HTTPS enforcement is disabled. This may expose sensitive data over the network.")
    reqs.packages.urllib3.disable_warnings(reqs.packages.urllib3.exceptions.InsecureRequestWarning) #type: ignore
else:
    Logger.info("HTTPS enforcement is enabled. All requests will be made over HTTPS.")


RE_URL = re.compile(
    r'^https?://'  # http:// or https://
    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # domain...
    r'localhost|'  # localhost...
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|'  # ...or ipv4
    r'\[?[A-F0-9]*:[A-F0-9:]+\]?)'  # ...or ipv6
    r'(?::\d+)?'  # optional port
    r'(?:/?|[/?]\S+)$', re.IGNORECASE)



class RequestFailed(Exception):
    """Custom exception for request failures."""
    def __init__(self, code: int, message: str = ""):
        self.code = code
        if message:
            self.message = f"Request failed with status code {code}: {message}"
        else:
            self.message = f"Request failed with status code {code}"
        super().__init__(self.message)
        
class ConfigError(Exception):
    """Custom exception for configuration errors."""
    def __init__(self, message: str):
        self.message = f"Configuration error: {message}"
        super().__init__(self.message)



def raise_for_status(response: reqs.Response) -> None:
    """Raise an exception for HTTP error responses."""
    if not response.ok:
        try:
            error_message = response.json().get('error', '')
        except ValueError:
            error_message = ''
        Logger.error(f"Request failed with status code {response.status_code}: {error_message}")
        raise RequestFailed(response.status_code, error_message)


def build_url(path: str) -> str:
    """Build the full URL for the API endpoint."""
    base_url = CONF.api_url
    if not RE_URL.match(base_url):
        raise ConfigError(f"Invalid API URL: {base_url}")
    if base_url.endswith("/"):
        base_url = base_url[:-1]
    if not path.startswith("/"):
        path = "/" + path
    return base_url + "/api/v1" + path



# def create_creation(name: str, code: str = "", description: str = "", workshop_link: str = "",
#                     manufacturer_id: int | None = None, operator_id: int | None = None,
#                     type: int = 0, usage: int = 0, creation_date: str = "", status: int = 0) -> dict[str, Any]:
    
#     url = build_url("/creation")
#     payload = {
#         "name": name,
#         "code": code,
#         "description": description,
#         "workshop_link": workshop_link,
#         "manufacturer_id": manufacturer_id,
#         "operator_id": operator_id,
#         "type": type,
#         "usage": usage,
#         "creation_date": creation_date,
#         "status": status
#     }
#     response = reqs.post(url, json=payload, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()

# def get_creation(creation_id: int) -> dict[str, Any]:
#     url = build_url(f"/creation/{creation_id}")
#     response = reqs.get(url, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()

# def get_creation_types() -> dict[str, int]:
#     url = build_url("/creation/types")
#     response = reqs.get(url, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()

# def get_creation_usages() -> dict[str, int]:
#     url = build_url("/creation/usages")
#     response = reqs.get(url, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()

# def get_statuses() -> dict[str, int]:
#     url = build_url("/statuses")
#     response = reqs.get(url, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()


# def create_manufacturer(name: str, description: str = "", logo: str = "") -> dict[str, Any]:
#     url = build_url("/manufacturer")
#     payload = {
#         "name": name,
#         "description": description,
#         "logo": logo
#     }
#     response = reqs.post(url, json=payload, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()

# def get_manufacturer(manufacturer_id: int) -> dict[str, Any]:
#     url = build_url(f"/manufacturer/{manufacturer_id}")
#     response = reqs.get(url, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()


# def create_microcontroller(name: str, description: str = "", workshop_link: str = "",
#                            creation_date: str = "", status: int = 0) -> dict[str, Any]:
#     url = build_url("/microcontroller")
#     payload = {
#         "name": name,
#         "description": description,
#         "workshop_link": workshop_link,
#         "creation_date": creation_date,
#         "status": status
#     }
#     response = reqs.post(url, json=payload, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()

# def get_microcontroller(microcontroller_id: int) -> dict[str, Any]:
#     url = build_url(f"/microcontroller/{microcontroller_id}")
#     response = reqs.get(url, verify=ENFORCE_HTTPS)
#     response.raise_for_status()
#     return response.json()




class APIClient:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.headers = {}
        
    def __get_http(self, path: str) -> Any:
        url = build_url(path)
        Logger.debug(f"GET request to {url} with headers: {self.headers}")
        response = reqs.get(url, headers=self.headers, verify=ENFORCE_HTTPS)
        raise_for_status(response)
        Logger.debug(f"Response from {path}: {response.status_code} - {len(response.content)} bytes")
        return response.json()
    
    def __post_http(self, path: str, payload: dict[str, Any]) -> Any:
        url = build_url(path)
        Logger.debug(f"POST request to {url} with payload: {payload} and headers: {self.headers}")
        response = reqs.post(url, json=payload, headers=self.headers, verify=ENFORCE_HTTPS)
        raise_for_status(response)
        Logger.debug(f"Response from {path}: {response.status_code} - {len(response.content)} bytes")
        return response.json()
    
    @staticmethod
    def is_server_reachable() -> bool:
        try:
            url = build_url("/info")
            Logger.debug(f"Checking server reachability at {url}")
            response = reqs.get(url, verify=ENFORCE_HTTPS)
            return response.status_code == 200
        except reqs.exceptions.RequestException as e:
            return False
        
    def __enter__(self):
        try:
            token = self.login(self.username, self.password)
        except reqs.exceptions.ConnectionError as e:
            raise ConnectionError(f"Failed to connect to the server at `{CONF.api_url}`. Please ensure the server is running and the API URL is correct.") from None
        except RequestFailed as e:
            raise ConnectionError(f"Login failed with status code {e.code}. Please check your credentials.") from None
        except Exception as e:
            raise e
        
        self.headers = {"Authorization": f"Bearer {token}"}
        return self
        
    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is not None:
            print(f"An exception occurred: {exc_value}. Logging out.")
        self.logout()
        self.headers = {}
        
    def login(self, username: str, password: str) -> str:
        return self.__post_http("/login", {"username": username, "password": password})['token']

    def logout(self) -> None:
        self.__post_http("/logout", {})


    def create_creation(self, name: str, code: str = "", description: str = "", workshop_link: str = "",
                        manufacturer_id: int | None = None, operator_id: int | None = None,
                        type: int = 0, usage: int = 0, creation_date: str = "", status: int = 0) -> dict[str, Any]:
        return self.__post_http("/creation", {
            "name": name,
            "code": code,
            "description": description,
            "workshop_link": workshop_link,
            "manufacturer_id": manufacturer_id,
            "operator_id": operator_id,
            "type": type,
            "usage": usage,
            "creation_date": creation_date,
            "status": status
        })
    
    def get_creation(self, creation_id: int) -> dict[str, Any]:
        return self.__get_http(f"/creation/{creation_id}")

    def get_creations(self) -> list[dict[str, Any]]:
        return self.__get_http("/creations")


if __name__ == "__main__":
    from gamuLogger import Levels
    import traceback
    import sys
    
    Logger.set_level("stdout", Levels.DEBUG)
    
    srv_reachable = APIClient.is_server_reachable()
    if not srv_reachable:
        Logger.fatal(f"Server is not reachable at `{CONF.api_url}`. Please ensure the server is running and the API URL is correct.")
        sys.exit(1)
    try:
        with APIClient(username="admin", password="admin") as api:
        
            # api.create_creation(name="Test Creation", description="A test creation", type=1, usage=1, status=1)
            # creation = api.get_creation(creation_id=1)
            # print("Creation details:", json.dumps(creation, indent=4))
            creations = api.get_creations()
            print("Creations list:", json.dumps(creations, indent=4))
    except Exception as e:
        Logger.fatal(f"{e}")
        Logger.debug(traceback.format_exc())
