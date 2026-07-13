import requests as reqs
import typing

BASE_URL = "https://localhost:8080/api/v1"


K = typing.TypeVar('K')
V = typing.TypeVar('V')
def reverse_dict(d: typing.Dict[K, V]) -> typing.Dict[V, K]:
    return {v: k for k, v in d.items()}



def create_creation(name: str, code: str = "", description: str = "", workshop_link: str = "",
                    manufacturer_id: int | None = None, operator_id: int | None = None,
                    type: int = 0, usage: int = 0, creation_date: str = "", status: int = 0):
    
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
    response = reqs.post(url, json=payload, verify=False)
    response.raise_for_status()
    return response.json()


def get_creation(creation_id: int):
    url = f"{BASE_URL}/creation/{creation_id}"
    response = reqs.get(url, verify=False)
    response.raise_for_status()
    return response.json()

def get_creation_types() -> dict[str, int]:
    url = f"{BASE_URL}/creation_types"
    response = reqs.get(url, verify=False)
    response.raise_for_status()
    return response.json()

def get_creation_usages() -> dict[str, int]:
    url = f"{BASE_URL}/creation_usages"
    response = reqs.get(url, verify=False)
    response.raise_for_status()
    return response.json()

def get_statuses() -> dict[str, int]:
    url = f"{BASE_URL}/statuses"
    response = reqs.get(url, verify=False)
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    # Example usage
    # try:
    #     creation = create_creation(
    #         name="My Creation",
    #         type=1,
    #         usage=2,
    #         description="This is a second test creation."
    #     )
    #     print("Creation created successfully:", creation)
    # except reqs.HTTPError as e:
    #     print("Failed to create creation:", e)
    
    
    usages =    reverse_dict(get_creation_usages())
    types =     reverse_dict(get_creation_types())
    statuses =  reverse_dict(get_statuses())
    
    # Example usage of get_creation
    try:
        creation_id = 3  # Replace with a valid creation ID
        creation = get_creation(creation_id)
        # replace usage, type, and status with their corresponding names from the enums
        creation['usage'] = usages.get(creation['usage'], "Unknown")
        creation['type'] = types.get(creation['type'], "Unknown")
        creation['status'] = statuses.get(creation['status'], "Unknown")
        print("Creation details:", creation)
        
    except reqs.HTTPError as e:
        print("Failed to retrieve creation:", e)