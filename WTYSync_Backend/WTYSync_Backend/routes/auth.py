from flask import Blueprint
from flask import request
from flask import jsonify

from database.db import db
from models.user import User

auth = Blueprint("auth", __name__)

@auth.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        print("Received:", data, flush=True)

        firebase_uid = data.get("firebase_uid")
        name = data.get("name")
        email = data.get("email")
        contact = data.get("contact")

        existing = User.query.filter_by(email=email).first()

        if existing:
            print("User already exists")
            return jsonify({
                "success": True,
                "message": "User already exists"
            }), 200

        user = User(
            firebase_uid=firebase_uid,
            name=name,
            email=email,
            contact=contact
        )

        db.session.add(user)
        db.session.commit()

        print("Saved successfully in MySQL")

        return jsonify({
            "success": True,
            "message": "Registration Successful"
        })

    except Exception as e:
        db.session.rollback()
        print("DATABASE ERROR:", str(e), flush=True)

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500
    
    
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
    

@auth.route("/update-profile", methods=["PUT"])
def update_profile():

    try:

        data = request.get_json()

        firebase_uid = data.get("firebase_uid")

        user_data = User.query.filter_by(firebase_uid=firebase_uid).first()

        if not user_data:
            return jsonify({
                "success": False,
                "message": "User not found"
            }), 404

        user_data.name = data.get("name", user_data.name)
        user_data.email = data.get("email", user_data.email)
        user_data.contact = data.get("contact", user_data.contact)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Profile Updated Successfully",
            "user": {
                "name": user_data.name,
                "email": user_data.email,
                "contact": user_data.contact
            }
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500