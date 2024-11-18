import requests
import time
import tkinter as tk
from tkinter import ttk
import win32gui
import win32con
import win32api

url = "https://cdn2.arkdedicated.com/servers/asa/officialserverlist.json"

def get_server_info(number):
    response = requests.get(url)
    data = response.json()
    server_info = next((server for server in data if server["Name"].endswith(str(number))), None)
    return server_info

class ServerMonitor:
    def __init__(self, parent, remove_callback):
        self.frame = tk.Frame(parent, bg='white', bd=0, highlightthickness=0)
        self.frame.pack(fill='x', pady=2)
        
        self.input_container = tk.Frame(self.frame, bg='white', bd=0, highlightthickness=0)
        self.input_container.pack(side='left')
        
        self.label = tk.Label(self.input_container, text="Players: 0", 
                            font=("Segoe UI", 14),
                            bg='white', 
                            fg='#FFFF00',
                            bd=0)
        self.label.pack(side='left', padx=2)
        
        self.entry = tk.Entry(self.input_container, 
                            font=("Segoe UI", 13),
                            width=4,
                            bg='#222222',
                            fg='#FFFF00',
                            bd=1,
                            justify='center',
                            relief='solid',
                            insertbackground='#FFFF00',
                            selectbackground='#444444',
                            selectforeground='#FFFF00')
        
        self.server_name = tk.Label(self.input_container, text="NONE", 
                            font=("Segoe UI", 12),
                            bg='white', 
                            fg='#FFFF00',
                            bd=0)
        self.server_name.pack(side='left', padx=2)
        
        self.remove_btn = tk.Button(self.frame, text="×",
                                  font=("Segoe UI", 11),
                                  command=lambda: remove_callback(self),
                                  bg='white', 
                                  fg='#FFFF00',
                                  bd=0,
                                  activebackground='white',
                                  activeforeground='#FFFF66')
        self.remove_btn.pack(side='right', padx=2)
        
        self.entry.bind("<Return>", self.handle_entry)
        
        self.server_number = None
        
        self.update_job = None
        self.flash_job = None
        self.previous_players = 0  
        self.flash_count = 0 

    def flash_label(self):
        self.flash_count += 1
        if self.flash_count % 2 == 0:
            self.label.config(fg='#FF0000')
            self.server_name.config(fg='#FF0000')
        else:
            self.label.config(fg='#FFFF00')
            self.server_name.config(fg='#FFFF00')

        if self.flash_count < 10:  # 5초 동안 깜박임 (500ms * 10)
            self.flash_job = root.after(500, self.flash_label)
        else:
            self.label.config(fg='#FFFF00')
            self.server_name.config(fg='#FFFF00')
            self.flash_count = 0
            self.flash_job = None

    def start_flash(self):
        if not self.flash_job:  
            self.flash_count = 0
            self.flash_label()

    def stop_flash(self):
        if self.flash_job:
            root.after_cancel(self.flash_job)
            self.flash_job = None
            self.label.config(fg='#FFFF00')
            self.server_name.config(fg='#FFFF00')
            self.flash_count = 0

    def start_auto_update(self):
        if self.server_number:
            self.update_server_info()
            self.update_job = root.after(5000, self.start_auto_update)

    def stop_auto_update(self):
        if self.update_job:
            root.after_cancel(self.update_job)
            self.update_job = None

    def update_server_info(self):
        if self.server_number:
            server_info = get_server_info(self.server_number)
            if server_info:
                current_players = server_info['NumPlayers']
                if current_players != self.previous_players:
                    self.start_flash() 
                    self.previous_players = current_players
                
                self.label.config(text=f"Players: {current_players}")
                self.server_name.config(text=f"{server_info['Name']}")

    def handle_entry(self, event):
        self.server_number = self.entry.get()
        self.update_label()
        self.entry.pack_forget()
        self.start_auto_update()
        return "break"

    def update_label(self):
        server_info = get_server_info(self.server_number)
        if server_info:
            self.previous_players = server_info['NumPlayers']
            self.label.config(text=f"Players: {server_info['NumPlayers']}")
            self.server_name.config(text=f"{server_info['Name']}")
            self.entry.pack_forget()
        else:
            self.label.config(text="Server not found")
            self.server_name.config(text="")

root = tk.Tk()
root.title("Server Monitor")
root.overrideredirect(True)  
root.attributes(
    '-topmost', True,
    '-alpha', 1.0,
    '-transparentcolor', 'white',
    '-toolwindow', True  
)
root.configure(bg='white')


main_frame = tk.Frame(root, bg='white', bd=0, highlightthickness=0)
main_frame.pack(fill='both', expand=True, padx=5, pady=5)


button_frame = tk.Frame(main_frame, bg='white', bd=0, highlightthickness=0)
button_frame.pack(side='right', anchor='ne', fill='y', padx=(0,2), pady=2)


buttons_container = tk.Frame(button_frame, bg='white', bd=0, highlightthickness=0)
buttons_container.pack(side='top', anchor='ne')


add_btn = tk.Button(buttons_container, text="+", 
                   command=lambda: add_monitor(), 
                   font=("Segoe UI", 14, "bold"),
                   bg='white',
                   fg='#FFFF00',
                   bd=0,
                   highlightthickness=0,
                   activebackground='white',
                   activeforeground='#FFFF66')
add_btn.pack(side='left', padx=1)


exit_btn = tk.Button(buttons_container, text="⚫", 
                    command=lambda: root.destroy(),
                    font=("Segoe UI", 11, "bold"),
                    bg='white',
                    fg='#FF0000',
                    bd=0,
                    highlightthickness=0,
                    activebackground='white',
                    activeforeground='#FF4444')
exit_btn.pack(side='left', padx=1)


monitors_frame = tk.Frame(main_frame, bg='white', bd=0, highlightthickness=0)
monitors_frame.pack(side='left', fill='both', expand=True)


monitors = []


def remove_monitor(monitor):
    monitor.stop_auto_update()
    monitor.stop_flash()  
    monitor.frame.destroy()
    monitors.remove(monitor)


def add_monitor():
    monitor = ServerMonitor(monitors_frame, remove_monitor)
    monitors.append(monitor)
    monitor.entry.pack(side='left', padx=2, after=monitor.label)
    monitor.entry.focus_set()

root.mainloop()
