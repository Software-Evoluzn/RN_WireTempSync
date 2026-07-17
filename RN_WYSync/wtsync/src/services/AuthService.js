import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth'
import IP_ADDRESS from '../services/ipconfig'
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

export const registerUser = async (
    name,
    email,
    password,
    contact
) => {
    try {
        const userCrdential = await auth().createUserWithEmailAndPassword(
            email,
            password,
        );

        //Firebase UID
        console.log('Firebase UID =>', userCrdential.user.uid);

        const uid = userCrdential.user.uid;
        console.log("uid here ", uid)

        //Flask API Call
        const BASE_URL = `http://${IP_ADDRESS}:5006`;
        console.log('==============================');
        console.log('Calling Flask Register API...');
        console.log('URL:', `${BASE_URL}/register`);
        console.log('Request Body:', {
            firebase_uid: uid,
            name: name,
            email: email,
            contact: contact,
        });
        console.log('==============================');



        const response = await fetch(
            `${BASE_URL}/register`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firebase_uid: uid,
                    name: name,
                    email: email,
                    contact: contact,
                }),
            },
        );

        console.log('HTTP Status:', response.status);
        console.log('Response OK:', response.ok);

       


        const data = await response.json();

         console.log('Parsed Response:', data);


        console.log("sejal data ", data);
        console.log("response ", response)

        if (!response.ok) {
            throw new Error(data.message || 'Registration API Failed');
        }



        if (!data.success) {
            throw new Error(data.message);
        }
        return {
            success: true,
            user: userCrdential.user,
        };

    } catch (error) {
        console.log('Register Error:', error);

        return {
            success: false,
            message: error.message,
        };
    }
}

export const loginUser = async (email, password) => {
    try {
        const userCredential = await auth().signInWithEmailAndPassword(
            email,
            password
        )
        return {
            success: true,
            user: userCredential.user
        }

    } catch (error) {

        return {
            success: false,
            message: error.message
        };

    }


};

export const logoutUser = async () => {
    try {
        await auth().signOut();

        // Revoke Google access
        await GoogleSignin.revokeAccess();
        // Sign out from Google
        await GoogleSignin.signOut();

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
        };
    }
};


export const googleLogin = async () => {
    try {
        await GoogleSignin.hasPlayServices();

        const response = await GoogleSignin.signIn();
        console.log('SIGN IN RESPONSE:', JSON.stringify(response, null, 2));

        if (!isSuccessResponse(response)) {
            throw new Error('Google Sign-In cancelled');
        }

        const tokens = await GoogleSignin.getTokens();

        console.log('Google Tokens:', tokens);

        const credential = auth.GoogleAuthProvider.credential(
            tokens.idToken,
            tokens.accessToken,
        );

        const userCredential = await auth().signInWithCredential(credential);
        console.log("Firebase User:", userCredential.user);

        // ===============================
        // Save Google user in MySQL
        // ===============================

        const BASE_URL = `http://${IP_ADDRESS}:5006`;

        const apiResponse = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                firebase_uid: userCredential.user.uid,
                name: userCredential.user.displayName,
                email: userCredential.user.email,
                contact: userCredential.user.phoneNumber || "",
            }),
        });
        const data = await apiResponse.json();

        console.log("Flask Response:", data);
        return {
            success: true,
            user: userCredential.user,
        };
    } catch (error) {
        console.log('Google Error:', error);

        return {
            success: false,
            message: error.message,
        };
    }
};

export const forgotPassword = async (email) => {
    try {
        await auth().sendPasswordResetEmail(email);

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
        };
    }
};


export const getUserDetails = async () => {
    try {
        const uid = auth().currentUser.uid;
        const BASE_URL = `http://${IP_ADDRESS}:5006`;

        const response = await fetch(`${BASE_URL}/get-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',

            },
            body: JSON.stringify({
                firebase_uid: uid,
            }),

        });

        const data = await response.json();
        console.log("get user data ", data);

        return data;

    } catch (error) {
        return {
            success: false,
            message: error.message,
        }

    }
}
