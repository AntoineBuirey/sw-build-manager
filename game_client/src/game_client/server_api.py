import requests as reqs
from typing import Any, Dict, TypeVar
import os
import json
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://localhost:8080/api/v1"


K = TypeVar('K')
V = TypeVar('V')
def reverse_dict(d: Dict[K, V]) -> Dict[V, K]:
    return {v: k for k, v in d.items()}


ENFORCE_HTTPS : bool = os.getenv("SWBM_MODE") != "development"
if not ENFORCE_HTTPS:
    reqs.packages.urllib3.disable_warnings(reqs.packages.urllib3.exceptions.InsecureRequestWarning) #type: ignore



def create_creation(name: str, code: str = "", description: str = "", workshop_link: str = "",
                    manufacturer_id: int | None = None, operator_id: int | None = None,
                    type: int = 0, usage: int = 0, creation_date: str = "", status: int = 0) -> dict[str, Any]:
    
    url = f"{BASE_URL}/creation"
    payload = {
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
    }
    response = reqs.post(url, json=payload, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()

def get_creation(creation_id: int) -> dict[str, Any]:
    url = f"{BASE_URL}/creation/{creation_id}"
    response = reqs.get(url, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()




def get_creation_types() -> dict[str, int]:
    url = f"{BASE_URL}/creation/types"
    response = reqs.get(url, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()

def get_creation_usages() -> dict[str, int]:
    url = f"{BASE_URL}/creation/usages"
    response = reqs.get(url, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()

def get_statuses() -> dict[str, int]:
    url = f"{BASE_URL}/statuses"
    response = reqs.get(url, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()


def create_manufacturer(name: str, description: str = "", logo: str = "") -> dict[str, Any]:
    url = f"{BASE_URL}/manufacturer"
    payload = {
        "name": name,
        "description": description,
        "logo": logo
    }
    response = reqs.post(url, json=payload, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()

def get_manufacturer(manufacturer_id: int) -> dict[str, Any]:
    url = f"{BASE_URL}/manufacturer/{manufacturer_id}"
    response = reqs.get(url, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()


def create_microcontroller(name: str, description: str = "", workshop_link: str = "",
                           creation_date: str = "", status: int = 0) -> dict[str, Any]:
    url = f"{BASE_URL}/microcontroller"
    payload = {
        "name": name,
        "description": description,
        "workshop_link": workshop_link,
        "creation_date": creation_date,
        "status": status
    }
    response = reqs.post(url, json=payload, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()

def get_microcontroller(microcontroller_id: int) -> dict[str, Any]:
    url = f"{BASE_URL}/microcontroller/{microcontroller_id}"
    response = reqs.get(url, verify=ENFORCE_HTTPS)
    response.raise_for_status()
    return response.json()

if __name__ == "__main__":
    usages =    get_creation_usages()
    types =     get_creation_types()
    statuses =  get_statuses()
    
    while True:
        cmd = input("""Enter command (
            create_creation,get_creation,
            create_manufacturer, get_manufacturer,
            create_microcontroller, get_microcontroller,
            exit): """)
        
        if cmd == "create_creation":
            name = input("Enter creation name: ")
            description = input("Enter creation description: ")
            workshop_link = input("Enter creation workshop link: ")
            manufacturer_id = int(input("Enter manufacturer ID (or 0 for None): "))
            operator_id = int(input("Enter operator ID (or 0 for None): "))
            type_str = input(f"Enter creation type {types}: ")
            usage_str = input(f"Enter creation usage {usages}: ")
            status_str = input(f"Enter creation status {statuses}: ")

            type_int = types.get(type_str.upper(), 0)
            usage_int = usages.get(usage_str.upper(), 0)
            status_int = statuses.get(status_str.upper(), 0)

            manufacturer_id = manufacturer_id if manufacturer_id != 0 else None
            operator_id = operator_id if operator_id != 0 else None

            creation = create_creation(name, '', description, workshop_link,
                                       manufacturer_id, operator_id,
                                       type_int, usage_int, '', status_int)
            print("Creation created:", json.dumps(creation, indent=4))
            
        elif cmd == "get_creation":
            creation_id = int(input("Enter creation ID: "))
            creation = get_creation(creation_id)
            print("Creation details:", json.dumps(creation, indent=4))
        
        elif cmd == "create_manufacturer":
            name = input("Enter manufacturer name: ")
            description = input("Enter manufacturer description: ")
            logo = input("Enter manufacturer logo URL: ")
            manufacturer = create_manufacturer(name, description, logo)
            print("Manufacturer created:", json.dumps(manufacturer, indent=4))
            
        elif cmd == "get_manufacturer":
            manufacturer_id = int(input("Enter manufacturer ID: "))
            manufacturer = get_manufacturer(manufacturer_id)
            print("Manufacturer details:", json.dumps(manufacturer, indent=4))
        
        elif cmd == "create_microcontroller":
            name = input("Enter microcontroller name: ")
            description = input("Enter microcontroller description: ")
            workshop_link = input("Enter microcontroller workshop link: ")
            creation_date = input("Enter microcontroller creation date (YYYY-MM-DD): ")
            status_str = input(f"Enter microcontroller status {statuses}: ")

            status_int = statuses.get(status_str, 0)

            microcontroller = create_microcontroller(name, description, workshop_link,
                                                     creation_date, status_int)
            print("Microcontroller created:", json.dumps(microcontroller, indent=4))
            
        elif cmd == "get_microcontroller":
            microcontroller_id = int(input("Enter microcontroller ID: "))
            microcontroller = get_microcontroller(microcontroller_id)
            print("Microcontroller details:", json.dumps(microcontroller, indent=4))
        
        elif cmd == "exit":
            break
        
        else:
            print("Unknown command. Please try again.")