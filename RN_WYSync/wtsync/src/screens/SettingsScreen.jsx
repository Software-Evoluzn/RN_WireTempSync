import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'


import React, { useEffect, useState } from 'react'

import { getUserDetails } from '../services/AuthService';

import { getProducts } from '../services/ProductApi';

import { logoutUser } from '../services/AuthService';

const SettingsScreen = ({ navigation }) => {

  const [user, setuser] = useState(null);


  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    loadSettingData();
  }, []);

  const loadSettingData = async () => {
    try {
      setLoading(true);

      const userResult = await getUserDetails();

      if (userResult.success) {
        console.log("sejal want to see this user details ", userResult.user);
        setuser(userResult.user)

      }

      const productResult = await getProducts();
      if (productResult.success) {
        console.log("sejal want to see the product list and no", productResult.products)
        console.log("sejal want to see the product list and no", productResult.products.length)

        setProducts(productResult.products);
        setProductCount(productResult.products.length)


      }

    } catch (error) {
      console.log("Setting screen ", error);

    } finally {
      setLoading(false);
    }
  }

  const userName = user?.name || "";
  const email = user?.email || "";
  const contact = user?.contact || "";


  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >

      <Text style={styles.screenTitle}>Settings</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </Text>
        </View>

        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.email}>{email}</Text>

      </View>

      {/* User Information */}
      <View style={styles.section}>

        <Text style={styles.sectionTitle}>Profile</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{userName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>
            {contact || "Not Available"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate("EditProfile")}>
          <Text style={styles.editButtonText}>
            Edit Profile
          </Text>
        </TouchableOpacity>

      </View>

      {/* Devices */}
      <View style={styles.section}>

        <Text style={styles.sectionTitle}>My Devices</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Registered Devices</Text>
          <Text style={styles.deviceCount}>
            {productCount}
          </Text>
        </View>

      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {

          logoutUser();
          navigation.replace("Login");
        }}>

        <Text style={styles.logoutText}>
          Logout
        </Text>

      </TouchableOpacity>

      <Text style={styles.version}>
        WireTempSync v1.0.0
      </Text>

    </ScrollView>
  );
}

export default SettingsScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FA",
    padding: 20,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 25,
  },

  profileCard: {
    backgroundColor: "#4F46E5",
    borderRadius: 22,
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 22,
    elevation: 6,
  },

  avatar: {
    width: 75,
    height: 75,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4F46E5",
  },

  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },

  email: {
    color: "#E5E7EB",
    marginTop: 4,
    fontSize: 15,
  },

  section: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    elevation: 3,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#111827",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  label: {
    color: "#6B7280",
    fontSize: 15,
  },

  value: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },

  deviceCount: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 17,
  },

  editButton: {
    marginTop: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },

  editButtonText: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 15,
  },

  logoutButton: {
    marginTop: 20,
    marginHorizontal: 20, // Space from left and right
    marginBottom: 30,     // Space from bottom

    backgroundColor: "#EF4444",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
  },

  version: {
    textAlign: "center",
    marginTop: "auto",
    color: "#9CA3AF",
    fontSize: 13,
  },




})