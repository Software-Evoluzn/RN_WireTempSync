from database.db import db

class ControlPanel(db.Model):
    __tablename__ = "control_panel"
    
    id = db.Column(db.Integer, primary_key=True)
    serial_no = db.Column(db.String(100), nullable=False)
    panel_index = db.Column(db.Integer, nullable=False) # e.g., 1, 2, 3...
    custom_name = db.Column(db.String(100), nullable=False)