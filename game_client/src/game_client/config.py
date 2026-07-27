import yaml


def str2bool(value: str) -> bool:
    """Convert a string to a boolean value."""
    if isinstance(value, bool):
        return value
    if value.lower() in ("yes", "true", "t", "1"):
        return True
    elif value.lower() in ("no", "false", "f", "0"):
        return False
    else:
        raise ValueError(f"Cannot convert {value} to boolean.")


class Config:
    def __init__(self, config_file: str = "config.yml"):
        self.config_file = config_file
        self.config_data = self.load_config()
        
        self.required = ["enforce_https", "api_url"]

    def load_config(self) -> dict:
        try:
            with open(self.config_file, "r") as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            print(f"Configuration file '{self.config_file}' not found. Using default settings.")
            return {}
        except yaml.YAMLError as e:
            print(f"Error parsing configuration file: {e}. Using default settings.")
            return {}
        
        if not all(key in self.config_data for key in self.required):
            raise KeyError(f"Missing required configuration keys: {', '.join(key for key in self.required if key not in self.config_data)}")

    @property
    def enforce_https(self) -> bool:
        return str2bool(self.config_data["enforce_https"])
    
    @property
    def api_url(self) -> str:
        return self.config_data["api_url"]
    
    
if __name__ == "__main__":
    config = Config()
    print("Enforce HTTPS:", config.enforce_https)
    print("API URL:", config.api_url)