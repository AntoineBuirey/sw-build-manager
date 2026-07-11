import lxml.etree as ET
import os

from game_path import GamePath
from matrix import Dimensions3D


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
        self.__dimensions_cache = None
        self.__voxel_positions_cache = None
        
    @classmethod
    def load(cls, file_path):
        if file_path in cls.__files_cache:
            return cls.__files_cache[file_path]
        return cls(file_path)

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
    
    def get_dimensions(self) -> Dimensions3D:
        if self.__dimensions_cache is not None:
            return self.__dimensions_cache

        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')
        for x, y, z in self.get_voxel_positions():
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_z = min(min_z, z)
            max_z = max(max_z, z)

        if min_x == float('inf'):
            self.__dimensions_cache = Dimensions3D(0, 0, 0)
            return self.__dimensions_cache

        self.__dimensions_cache = Dimensions3D(max_x - min_x + 1, max_y - min_y + 1, max_z - min_z + 1)
        return self.__dimensions_cache

    def get_voxel_positions(self) -> list[tuple[int, int, int]]:
        if self.__voxel_positions_cache is not None:
            return self.__voxel_positions_cache

        voxel_positions = []
        for voxel in self.root.findall('.//voxels/voxel'):
            position = voxel.find('position')
            if position is None:
                continue

            x = int(float(position.attrib.get('x', 0)))
            y = int(float(position.attrib.get('y', 0)))
            z = int(float(position.attrib.get('z', 0)))
            voxel_positions.append((x, y, z))

        self.__voxel_positions_cache = voxel_positions
        return self.__voxel_positions_cache


if __name__ == "__main__":
    files = os.listdir(GamePath.definitions)
    csv_string = "Name;Mass;Value;Category;Tags;Length;Width;Height\n"
    for file_path in sorted(files):
        if file_path.endswith(".xml"):
            def_file = DefFile.load(os.path.join(GamePath.definitions, file_path))
            name = def_file.get_name()
            mass = def_file.get_mass()
            value = def_file.get_value()
            category = def_file.get_category()
            tags = def_file.get_tags()
            dimensions = def_file.get_dimensions()
            
            print(f"Name: {name}, Mass: {mass}, Value: {value}, Category: {category}, Tags: {tags}, Dimensions: {dimensions}")
            csv_string += f"{name};{mass};{value};{category};{', '.join(tags)};{dimensions.length};{dimensions.width};{dimensions.height}\n"


    with open("./def_summary.csv", "w") as f:
        f.write(csv_string)
