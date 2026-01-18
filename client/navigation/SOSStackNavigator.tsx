import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SOSScreen from '@/screens/SOSScreen';
import { useScreenOptions } from '@/hooks/useScreenOptions';

export type SOSStackParamList = {
  SOS: undefined;
};

const Stack = createNativeStackNavigator<SOSStackParamList>();

export default function SOSStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="SOS"
        component={SOSScreen}
        options={{
          headerTitle: 'SOS',
        }}
      />
    </Stack.Navigator>
  );
}
