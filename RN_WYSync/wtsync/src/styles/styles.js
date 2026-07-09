import { StyleSheet } from 'react-native';

const PRIMARY = '#5B4BFF';
const BG = '#F6F7FB';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    padding: 20,
  },

  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 25,
    marginTop: 10,
  },

  /* ---------- Scan Button ---------- */

  scanButton: {
    backgroundColor: PRIMARY,
    height: 55,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    elevation: 4,
  },

  scanButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  /* ---------- Scanner ---------- */

  scannerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },

  camera: {
    width: 280,
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
  },

  cameraBox: {

    width: 280,

    height: 280,

    borderRadius: 20,

    overflow: 'hidden',

    position: 'relative',

  },

  scanLine: {

    position: 'absolute',

    top: 0,

    left: 20,

    right: 20,

    height: 3,

    backgroundColor: '#00E676',

    borderRadius: 10,

  },

  corner: {

    position: 'absolute',

    width: 40,

    height: 40,

    borderColor: '#00C853',

  },

  topLeft: {

    top: 10,

    left: 10,

    borderTopWidth: 5,

    borderLeftWidth: 5,

  },

  topRight: {

    top: 10,

    right: 10,

    borderTopWidth: 5,

    borderRightWidth: 5,

  },

  bottomLeft: {

    bottom: 10,

    left: 10,

    borderBottomWidth: 5,

    borderLeftWidth: 5,

  },

  bottomRight: {

    bottom: 10,

    right: 10,

    borderBottomWidth: 5,

    borderRightWidth: 5,

  },

  scanText: {
    marginTop: 15,
    color: '#666',
    fontSize: 15,
  },

  /* ---------- Card ---------- */

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,

    elevation: 4,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
    marginBottom: 15,
  },

  /* ---------- Product Row ---------- */

  row: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
  },

  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },

  value: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
  },

  /* ---------- Date ---------- */

  dateButton: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },

  dateText: {
    fontSize: 16,
    color: '#444',
  },

  /* ---------- Register ---------- */

  registerButton: {
    backgroundColor: PRIMARY,
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
    elevation: 5,
  },

  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});