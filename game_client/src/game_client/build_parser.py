import lxml.etree as ET
from def_parser import DefFile

"""
<?xml version="1.0" encoding="UTF-8"?>
<vehicle data_version="3" bodies_id="3496">
    <authors/>
    <bodies>
        <body>
            <components>
                <c d="rope_hook_composite" t="5">
                    <o r="1,0,0,0,1,0,0,0,1" bc="524845" bc2="FFFFFF" sc="6,x,524845,524845,524845,524845,x" input_velocity="1">
                        <vp x="7" y="-6" z="49"/>
                        <logic_slots>
                            <slot/>
                            <slot/>
                            <slot/>
                        </logic_slots>
                    </o>
                </c>
                <c d="01_block_weight">
                    <o r="-1,0,0,0,1,0,0,0,-1" bc="524845" ac="524845" sc="6">
                        <vp x="7" y="-9" z="49"/>
                    </o>
                </c>
                <c d="01_block_weight">
                    <o r="-1,0,0,0,1,0,0,0,-1" bc="524845" ac="524845" sc="6">
                        <vp x="7" y="-10" z="49"/>
                    </o>
                </c>
                <c d="magall">
                    <o r="-1,0,0,0,-1,0,0,0,1" bc="524845" ac="524845" sc="5">
                        <vp x="8" y="-11" z="49"/>
                        <logic_slots>
                            <slot editor_connected="1"/>
                            <slot/>
                            <slot/>
                        </logic_slots>
                    </o>
                </c>
                <c d="magall" t="1">
                    <o r="-1,0,0,0,-1,0,0,0,1" bc="524845" ac="524845" sc="5">
                        <vp x="6" y="-11" z="49"/>
                        <logic_slots>
                            <slot editor_connected="1"/>
                            <slot/>
                            <slot/>
                        </logic_slots>
                    </o>
                </c>
                ...
"""


"""   
-1  0  0
 0 -1  0
 0  0  1
"""

def get_block_size(string_rotation_matrix: str, original_block_size : tuple[float, float, float]) -> tuple[float, float, float]:
    """
    matrix: "-1,0,0,0,-1,0,0,0,1" ->
    original_block_size: (length, width, height)
    """
    # Convert the rotation matrix string to a list of floats
    matrix_values = list(map(float, string_rotation_matrix.split(',')))
    
    # Reshape the list into a 3x3 matrix
    rotation_matrix = [
        [matrix_values[0], matrix_values[1], matrix_values[2]],
        [matrix_values[3], matrix_values[4], matrix_values[5]],
        [matrix_values[6], matrix_values[7], matrix_values[8]]
    ]
    
    # Calculate the new dimensions based on the rotation matrix
    new_length = abs(rotation_matrix[0][0]) * original_block_size[0] \
                + abs(rotation_matrix[0][1]) * original_block_size[1] \
                + abs(rotation_matrix[0][2]) * original_block_size[2]
    new_width = abs(rotation_matrix[1][0]) * original_block_size[0] \
                + abs(rotation_matrix[1][1]) * original_block_size[1] \
                + abs(rotation_matrix[1][2]) * original_block_size[2]
    new_height = abs(rotation_matrix[2][0]) * original_block_size[0]  \
                + abs(rotation_matrix[2][1]) * original_block_size[1] \
                + abs(rotation_matrix[2][2]) * original_block_size[2]
    
    return (new_length, new_width, new_height)
    
    


class BuildFile:
    __parser = ET.XMLParser(recover=True, encoding='utf-8', remove_blank_text=True)
    def __init__(self, file_path):
        self.file_path = file_path
        self.tree = ET.parse(file_path, parser=self.__parser)
        self.root = self.tree.getroot()
    
    def get_name(self) -> str:
        return self.file_path.split('/')[-1].replace('.xml', '')
    
    def get_dimensions(self) -> tuple[float, float, float]:
        # compute from positions of components; take into account rotation of components and their original dimensions
        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')
        for component in self.root.findall('.//components/c'):
            block_def = component.attrib.get('d')
            if not block_def:
                block_def = "01_block"
            def_file_path = f"/data/sw-build-manager/definitions/{block_def}.xml"
            def_file = DefFile(def_file_path)
            original_block_size = def_file.get_dimensions()
            
            position = component.find('o/vp')
            rotation_matrix_str = component.find('o').attrib.get('r', '1,0,0,0,1,0,0,0,1')
            if position is not None:
                x = float(position.attrib.get('x', 0))
                y = float(position.attrib.get('y', 0))
                z = float(position.attrib.get('z', 0))
                
                # Get the rotated block size
                rotated_block_size = get_block_size(rotation_matrix_str, original_block_size)
                
                min_x = min(min_x, x)
                max_x = max(max_x, x + rotated_block_size[0] - 1)
                min_y = min(min_y, y)
                max_y = max(max_y, y + rotated_block_size[1] - 1)
                min_z = min(min_z, z)
                max_z = max(max_z, z + rotated_block_size[2] - 1)
                
        return (max_x - min_x + 1, max_y - min_y + 1, max_z - min_z + 1)
    
    def draw_front_face(self):
        # draw the build in 2D in the terminal, using the front face (y-axis) and z-axis for height
        # take into account the rotation of components and their original dimensions
        width, height, length = self.get_dimensions()
        front_face : dict[tuple[int, int], int] = {}  # dict of (x, y) -> nb_components at that position on the Y axis
        # create a 2D array of spaces
        for component in self.root.findall('.//components/c'):
            block_def = component.attrib.get('d')
            if not block_def:
                block_def = "01_block"
            def_file_path = f"/data/sw-build-manager/definitions/{block_def}.xml"
            def_file = DefFile(def_file_path)
            original_block_size = def_file.get_dimensions()
            
            position = component.find('o/vp')
            rotation_matrix_str = component.find('o').attrib.get('r', '1,0,0,0,1,0,0,0,1')
            if position is not None:
                x = float(position.attrib.get('x', 0))
                y = float(position.attrib.get('y', 0))
                z = float(position.attrib.get('z', 0))
                
                # Get the rotated block size
                rotated_block_size = get_block_size(rotation_matrix_str, original_block_size)
                
                # Draw the component on the front face
                for i in range(int(rotated_block_size[1])):  # height
                    for j in range(int(rotated_block_size[2])):  # length
                        if not (int(x) + j, int(y) + i) in front_face:
                            front_face[(int(x) + j, int(y) + i)] = 0
                        front_face[(int(x) + j, int(y) + i)] = front_face.get((int(x) + j, int(y) + i), 0) + 1
                    
        # Normalize the front face to a 2D array of characters with the lower x and y being 0,0
        min_x = min(x for x, y in front_face.keys())
        min_y = min(y for x, y in front_face.keys())
        normalized_front_face : dict[tuple[int, int], int] = {}
        for (x, y), count in front_face.items():
            normalized_front_face[(x - min_x, y - min_y)] = count   

        # Draw the normalized front face
        for y in range(int(height), -1, -1):
            line = ""
            for x in range(int(width)):
                count = normalized_front_face.get((x, y), 0)
                line += str(count) if count > 0 else " "
                    
            print(line)

    
if __name__ == "__main__":
    DEF_DIR = "/data/sw-build-manager/definitions/"
    build_file = "/data/sw-build-manager/large anchor.xml"
    build = BuildFile(build_file)
    print(f"Build Name: {build.get_name()}")
    width, height, length = build.get_dimensions()
    print(f"Build Dimensions: Width={width}, Height={height}, Length={length}")
    
    build.draw_front_face()  # Draw the front face of the build in the terminal