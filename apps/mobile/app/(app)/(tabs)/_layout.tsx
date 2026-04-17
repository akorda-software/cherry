import { Tabs } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";

export default function TabsLayoutRoute() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused, size }) => (
            <HomeIcon color={color} filled={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused, size }) => (
            <ProfileIcon color={color} filled={focused} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

interface IconProps {
  color: string;
  filled: boolean;
  size: number;
}

function HomeIcon({ color, filled, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.75 9.75 12 3l8.25 6.75V19.5a1.5 1.5 0 0 1-1.5 1.5h-4.125v-6.75h-5.25V21H5.25a1.5 1.5 0 0 1-1.5-1.5V9.75z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ProfileIcon({ color, filled, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={8}
        r={4}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.75}
      />
      <Path
        d="M4 20.5a8 8 0 0 1 16 0"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}
