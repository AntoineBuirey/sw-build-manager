import os
import lxml.etree as ET
from def_parser import DefFile
from game_path import GamePath
from matrix import Matrix3x3, Dimensions3D
from progress_bar import ProgressBar

class BuildFile:
    __parser = ET.XMLParser(recover=True, encoding='utf-8', remove_blank_text=True)
    def __init__(self, file_path):
        self.file_path = file_path
        self.tree = ET.parse(file_path, parser=self.__parser)
        self.root = self.tree.getroot()
    
    def get_name(self) -> str:
        return self.file_path.split('/')[-1].replace('.xml', '')
    def __iter_world_voxels(self):
        components = self.root.findall('.//components/c')
        pb = ProgressBar(total=len(components))
        for component in components:
            pb.update(1)
            block_def = component.attrib.get('d') or '01_block'
            def_file_path = os.path.join(GamePath.definitions, f"{block_def}.xml")
            def_file = DefFile.load(def_file_path)

            transform = component.find('o')
            position = component.find('o/vp')
            if transform is None or position is None:
                continue

            rotation = Matrix3x3.from_string(transform.attrib.get('r', '1,0,0,0,1,0,0,0,1'))

            component_x = int(float(position.attrib.get('x', 0)))
            component_y = int(float(position.attrib.get('y', 0)))
            component_z = int(float(position.attrib.get('z', 0)))

            for local_x, local_y, local_z in def_file.get_voxel_positions():

                rotated_x = int(rotation[0, 0] * local_x + rotation[1, 0] * local_y + rotation[2, 0] * local_z)
                rotated_y = int(rotation[0, 1] * local_x + rotation[1, 1] * local_y + rotation[2, 1] * local_z)
                rotated_z = int(rotation[0, 2] * local_x + rotation[1, 2] * local_y + rotation[2, 2] * local_z)

                yield (component_x + rotated_x, component_y + rotated_y, component_z + rotated_z)
    
    def get_dimensions(self) -> Dimensions3D:
        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')

        has_voxels = False
        for x, y, z in self.__iter_world_voxels():
            has_voxels = True
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_z = min(min_z, z)
            max_z = max(max_z, z)

        if not has_voxels:
            return Dimensions3D(0, 0, 0)

        # Keep the build convention aligned with the terminal view:
        # width tracks X, height tracks Y, and length tracks Z.
        return Dimensions3D(max_z - min_z + 1, max_x - min_x + 1, max_y - min_y + 1)
    
    def draw_front_face(self):
        """
        draw the build in 2D in the terminal, viewed from the front (x-y plane, looking along the z-axis)
        the coordinates of the blocks are not normalized (they can be negative, or starting at a different value than 0), so they must be normalized to fit in the 2D array, and be drawn in the correct position
        """
        min_x = min_y = float('inf')
        max_x = max_y = float('-inf')
        projected_voxels = {}

        for world_x, world_y, world_z in self.__iter_world_voxels():
                key = (world_x, world_y)
                projected_voxels[key] = projected_voxels.get(key, 0) + 1
                min_x = min(min_x, world_x)
                max_x = max(max_x, world_x)
                min_y = min(min_y, world_y)
                max_y = max(max_y, world_y)

        if not projected_voxels:
            return

        width = int(max_x - min_x + 1)
        height = int(max_y - min_y + 1)

        front_face = [[' ' for _ in range(width)] for _ in range(height)]

        for (world_x, world_y), count in projected_voxels.items():
            col = world_x - min_x
            row = max_y - world_y
            front_face[row][col] = str(count) if count < 10 else '+'

        for row in front_face:
            print(''.join(row))

    
if __name__ == "__main__":
    build_file = os.path.join(GamePath.vehicles, "Palinure w engines.xml")
    build = BuildFile(build_file)
    print(f"Build Name: {build.get_name()}")
    dimensions = build.get_dimensions()
    print(f"Build Dimensions: Width={dimensions.width}, Height={dimensions.height}, Length={dimensions.length}")
    
    # build.draw_front_face()  # Draw the front face of the build in the terminal