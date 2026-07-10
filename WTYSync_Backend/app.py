from flask import Flask
from flask_cors import CORS

from config import Config
from database.db import db

from routes.auth import auth
from routes.product import product

from mqtt_service import start_mqtt , init_app

app = Flask(__name__)

CORS(app)

app.config.from_object(Config)

db.init_app(app)

with app.app_context():

    db.create_all()
    
# Give Flask app to MQTT
init_app(app)

app.register_blueprint(auth)
app.register_blueprint(product)

@app.route("/")
def home():

    return {

        "message":"Backend Running"

    }

if __name__=="__main__":
    start_mqtt()

    app.run(

        host="0.0.0.0",
        port=5000,
        debug=True

    )