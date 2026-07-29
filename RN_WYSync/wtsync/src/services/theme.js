import { useColorScheme } from 'react-native';

export const useAppTheme = () => {
  const isDark = useColorScheme() === 'dark';

  return {
    isDark,
    colors: {
      background: isDark ? '#121212' : '#FFFFFF',
      card: isDark ? '#1E1E1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#1B2A4A',
      subText: isDark ? '#A0A0A0' : '#8A93A6',
      border: isDark ? '#333333' : '#E7EAF3',
      primary: '#2563EB',
    },
  };
};