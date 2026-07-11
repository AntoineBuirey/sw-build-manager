


class Matrix3x3:
    def __init__(self, values):
        if len(values) != 9:
            raise ValueError("Matrix3x3 requires exactly 9 values.")
        self.values = values

    def __getitem__(self, index):
        row, col = index
        return self.values[row * 3 + col]

    def __setitem__(self, index, value):
        row, col = index
        self.values[row * 3 + col] = value
        
    @classmethod
    def from_string(cls, string):
        values = list(map(float, string.split(',')))
        return cls(values)

    def __str__(self):
        return f"[{self[0,0]}, {self[0,1]}, {self[0,2]}]\n"
    
class Dimensions3D:
    def __init__(self, length: float, width: float, height: float):
        self.length = length
        self.width = width
        self.height = height

    def __str__(self):
        return f"Dimensions3D(length={self.length}, width={self.width}, height={self.height})"

    def apply_rotation(self, rotation_matrix: Matrix3x3) -> None:
        """
        Apply the rotation matrix to the dimensions and return the new dimensions.
        The matrix may not be orthogonal, so we compute the new dimensions based on the absolute values of the matrix.
        """
        new_length = (abs(rotation_matrix[0, 0]) * self.length +
                      abs(rotation_matrix[0, 1]) * self.width +
                      abs(rotation_matrix[0, 2]) * self.height)
        
        new_width = (abs(rotation_matrix[1, 0]) * self.length +
                     abs(rotation_matrix[1, 1]) * self.width +
                     abs(rotation_matrix[1, 2]) * self.height)
        
        new_height = (abs(rotation_matrix[2, 0]) * self.length +
                      abs(rotation_matrix[2, 1]) * self.width +
                      abs(rotation_matrix[2, 2]) * self.height)
        
        self.length = new_length
        self.width = new_width
        self.height = new_height
        
    
    