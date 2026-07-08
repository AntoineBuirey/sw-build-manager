import lxml.etree as ET
import os


class DefFile:
    __files_cache = {}
    __parser = ET.XMLParser(recover=True, encoding='utf-8', remove_blank_text=True)
    
    def __new__(cls, file_path):
        if file_path in cls.__files_cache:
            return cls.__files_cache[file_path]
        instance = super(DefFile, cls).__new__(cls)
        cls.__files_cache[file_path] = instance
        return instance
    
    def __init__(self, file_path):
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Definition file not found: {file_path}")
        self.file_path = file_path
        self.tree = ET.parse(file_path, parser=self.__parser)
        self.root = self.tree.getroot()

    def get_mass(self) -> float:
        return float(self.root.attrib.get('mass', 0.0))
    
    def get_value(self) -> int:
        return int(self.root.attrib.get('value', 0))
    
    def get_name(self) -> str:
        return self.root.attrib.get('name', '')
    
    def get_category(self) -> int:
        return int(self.root.attrib.get('category', 0))

    def get_tags(self) -> list[str]:
        tags_str = self.root.attrib.get('tags', '')
        return [tag.strip() for tag in tags_str.split(',') if tag.strip()]
    
    def get_dimensions(self) -> tuple[float, float, float]:
        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')
        for voxel in self.root.findall('.//voxels/voxel'):
            position = voxel.find('position')
            if position is not None:
                x = float(position.attrib.get('x', 0))
                y = float(position.attrib.get('y', 0))
                z = float(position.attrib.get('z', 0))
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                min_z = min(min_z, z)
                max_z = max(max_z, z)
        return (max_x - min_x + 1, max_y - min_y + 1, max_z - min_z + 1)


if __name__ == "__main__":
    # /data/sw-build-manager/definitions/
    files = os.listdir("/data/sw-build-manager/definitions/")
    csv_string = "Name;Mass;Value;Category;Tags;Length;Width;Height\n"
    for file_path in sorted(files):
        if file_path.endswith(".xml"):
            def_file = DefFile(os.path.join("/data/sw-build-manager/definitions/", file_path))
            name = def_file.get_name()
            mass = def_file.get_mass()
            value = def_file.get_value()
            category = def_file.get_category()
            tags = def_file.get_tags()
            dimensions = def_file.get_dimensions()
            
            print(f"Name: {name}, Mass: {mass}, Value: {value}, Category: {category}, Tags: {tags}, Dimensions: {dimensions}")
            csv_string += f"{name};{mass};{value};{category};{', '.join(tags)};{dimensions[0]};{dimensions[1]};{dimensions[2]}\n"


    with open("/data/sw-build-manager/def_summary.csv", "w") as f:
        f.write(csv_string)
