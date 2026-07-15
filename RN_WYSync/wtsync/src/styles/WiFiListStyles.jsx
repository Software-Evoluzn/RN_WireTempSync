import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  heading: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  subtitle: {
    marginBottom: 20,
    color: '#666',
  },

  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },

  signalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },

  ssidText: {
    fontSize: 16,
    fontWeight: '600',
  },

  metaText: {
    color: '#777',
    fontSize: 12,
  },

  chevron: {
    fontSize: 24,
  },
});