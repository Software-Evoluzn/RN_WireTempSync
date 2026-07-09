from flask import Flask
from flask_cors import CORS

from config import Config
from database.db import db

from routes.auth import auth
from routes.product import product

app = Flask(__name__)

CORS(app)

app.config.from_object(Config)

db.init_app(app)

with app.app_context():

    db.create_all()

app.register_blueprint(auth)
app.register_blueprint(product)

@app.route("/")
def home():

    return {

        "message":"Backend Running"

    }

if __name__=="__main__":

    app.run(

        host="0.0.0.0",
        port=5000,
        debug=True

    )