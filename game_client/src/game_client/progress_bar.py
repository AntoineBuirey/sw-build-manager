class ProgressBar:
    def __init__(self, total, length=100):
        self.total = total
        self.length = length
        self.current = 0

    def update(self, progress):
        self.current += progress
        filled_length = int(self.length * self.current // self.total)
        bar = '█' * filled_length + '-' * (self.length - filled_length)
        print(f'\r|{bar}| {self.current}/{self.total}', end='\r')
        if self.current >= self.total:
            print(" "*(self.length + 20), end='\r')  # Clear the line
