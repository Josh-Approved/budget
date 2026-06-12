/**
 * App root for the budget app. The shell (<AppShell/>) owns all the chrome; this
 * file owns the readiness gate (fonts + store hydration), the screen list, and
 * applying the user's appearance preference.
 */

import React, { useEffect } from 'react';
import { Appearance } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppFonts } from './src/theme';
import { AppShell } from './src/shell/AppShell';
import { useBudgetStore } from './src/store/budget';
import HomeScreen from './src/screens/HomeScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import CategoryEditScreen from './src/screens/CategoryEditScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import AccountEditScreen from './src/screens/AccountEditScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import ChooseScreen from './src/screens/ChooseScreen';
import Credits from './src/components/Credits';
import { QA_MODE } from './src/qa/qaMode';
import type { TxKind } from './src/data/budget';

// Hold the native launch screen until the JS splash takes over (no icon blink).
// Skipped under QA_MODE so the capture harness sees deterministic frames.
if (!QA_MODE) {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export type RootStackParamList = {
  Home: undefined;
  AddTransaction: { kind?: TxKind; accountId?: string; editId?: string } | undefined;
  Categories: undefined;
  CategoryEdit: { editId?: string; kind?: TxKind } | undefined;
  Accounts: undefined;
  AccountEdit: { editId?: string } | undefined;
  Recurring: undefined;
  Choose: { field: 'currency' | 'defaultAccount' | 'defaultCategory' };
  Settings: undefined;
  Acknowledgements: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const hydrated = useBudgetStore((s) => s.hydrated);
  const hydrate = useBudgetStore((s) => s.hydrate);
  const theme = useBudgetStore((s) => s.settings.theme);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Apply the appearance preference app-wide (system = follow the OS). This
  // drives useColorScheme() in both the shell and the app screens.
  useEffect(() => {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  }, [theme]);

  const ready = fontsLoaded && hydrated;

  return (
    <AppShell ready={ready}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false, animation: QA_MODE ? 'none' : undefined }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Categories" component={CategoriesScreen} />
        <Stack.Screen name="CategoryEdit" component={CategoryEditScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="AccountEdit" component={AccountEditScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Recurring" component={RecurringScreen} />
        <Stack.Screen name="Choose" component={ChooseScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Acknowledgements">
          {(props) => <Credits onBack={() => props.navigation.goBack()} />}
        </Stack.Screen>
      </Stack.Navigator>
    </AppShell>
  );
}
