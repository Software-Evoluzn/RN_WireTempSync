from flask import Blueprint
from flask import request
from flask import jsonify

from database.db import db
from models.user import User

auth = Blueprint("auth", __name__)

@auth.route("/register", methods=["POST"])
def register():

    data = request.get_json()
    print("Received data =>", data, flush=True)   # terminal mein dikhega
    firebase_uid = data.get("firebase_uid")
    name = data.get("name")
    email = data.get("email")
    contact = data.get("contact")

    if not firebase_uid or not name or not email:

        return jsonify({
            "success":False,
            "message":"Missing fields"
        }),400

    existing = User.query.filter_by(email=email).first()

    if existing:

        return jsonify({
            "success":True,
            "message":"User already exists"
        }),200

    user = User(

        firebase_uid=firebase_uid,
        name=name,
        email=email,
        contact=contact

    )

    db.session.add(user)

    db.session.commit()

    return jsonify({

        "success":True,
        "message":"Registration Successful"

    })
    
    
@auth.route("/get-user", methods=["POST"])
def get_user():

    data = request.get_json()

    firebase_uid = data.get("firebase_uid")

    user = User.query.filter_by(firebase_uid=firebase_uid).first()
    
    
    print("here get user data" , user)

    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }),404

    return jsonify({
        "success": True,
        "user": {
            "firebase_uid": user.firebase_uid,
            "name": user.name,
            "email": user.email,
            "contact": user.contact
        }
    })