from database.db import db
from datetime import datetime

class TempValues(db.Model):
    __tablename__ = 'temp_values'

    id = db.Column(db.Integer, primary_key=True)
    serial_no = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Panel 1
    R1 = db.Column(db.Float, nullable=True)
    Y1 = db.Column(db.Float, nullable=True)
    B1 = db.Column(db.Float, nullable=True)
    N1 = db.Column(db.Float, nullable=True)
    
    # Panel 2
    R2 = db.Column(db.Float, nullable=True)
    Y2 = db.Column(db.Float, nullable=True)
    B2 = db.Column(db.Float, nullable=True)
    N2 = db.Column(db.Float, nullable=True)

    # Panel 3
    R3 = db.Column(db.Float, nullable=True)
    Y3 = db.Column(db.Float, nullable=True)
    B3 = db.Column(db.Float, nullable=True)
    N3 = db.Column(db.Float, nullable=True)

    # Panel 4
    R4 = db.Column(db.Float, nullable=True)
    Y4 = db.Column(db.Float, nullable=True)
    B4 = db.Column(db.Float, nullable=True)
    N4 = db.Column(db.Float, nullable=True)

    # Panel 5
    R5 = db.Column(db.Float, nullable=True)
    Y5 = db.Column(db.Float, nullable=True)
    B5 = db.Column(db.Float, nullable=True)
    N5 = db.Column(db.Float, nullable=True)

    # Panel 6
    R6 = db.Column(db.Float, nullable=True)
    Y6 = db.Column(db.Float, nullable=True)
    B6 = db.Column(db.Float, nullable=True)
    N6 = db.Column(db.Float, nullable=True)