from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from config import Config
from database.db import db

from routes.auth import auth
from routes.product import product
from routes.telemetry import telemetry
from routes.wifi import wifi_bp
from routes.telemetry_export import export_bp

from mqtt_service import start_mqtt, init_app

app = Flask(__name__)
CORS(app)
app.config.from_object(Config)

db.init_app(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

with app.app_context():
    db.create_all()

# ✅ Initialize app context & start background scheduler
init_app(app, socketio)

app.register_blueprint(auth)
app.register_blueprint(product)
app.register_blueprint(telemetry)
app.register_blueprint(wifi_bp)
app.register_blueprint(export_bp)

@app.route("/")
def home():
    return {"message": "Backend Running"}

if __name__ == "__main__":
    start_mqtt()
    # Added use_reloader=False to prevent Flask from doubling background threads
    socketio.run(
        app,
        host="0.0.0.0",
        port=5006,
        debug=True,
        use_reloader=False
    )