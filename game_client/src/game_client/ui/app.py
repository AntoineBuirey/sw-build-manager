import tkinter as th
from tkinter import ttk


class App(th.Tk):
    def __init__(self):
        super().__init__()
        self.title("Game Client")
        self.geometry("800x600")

        # Create a notebook (tabbed interface)
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill='both')

        # Create frames for each tab
        self.login_frame = ttk.Frame(self.notebook)
        self.game_frame = ttk.Frame(self.notebook)

        # Add frames to the notebook
        self.notebook.add(self.login_frame, text='Login')
        self.notebook.add(self.game_frame, text='Game')

        # Initialize the login and game UI
        self.init_login_ui()
        self.init_game_ui()

    def init_login_ui(self):
        # Add widgets for login UI
        ttk.Label(self.login_frame, text="Username:").pack(pady=10)
        self.username_entry = ttk.Entry(self.login_frame)
        self.username_entry.pack(pady=5)

        ttk.Label(self.login_frame, text="Password:").pack(pady=10)
        self.password_entry = ttk.Entry(self.login_frame, show="*")
        self.password_entry.pack(pady=5)

        self.login_button = ttk.Button(self.login_frame, text="Login", command=self.handle_login)
        self.login_button.pack(pady=20)

    def init_game_ui(self):
        # Add widgets for game UI
        ttk.Label(self.game_frame, text="Welcome to the Game!").pack(pady=20)