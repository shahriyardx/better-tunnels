import {
  GaugeIcon,
  TerminalIcon,
  PlusIcon,
} from "@phosphor-icons/react";

export interface NavItem {
  title: string;
  url: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  items?: { title: string; url: string }[];
}

export const navMain: NavItem[] = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: <GaugeIcon />,
    isActive: true,
  },
  {
    title: "Tunnels",
    url: "/dashboard/tunnels",
    icon: <TerminalIcon />,
  },
  {
    title: "New Tunnel",
    url: "/dashboard/new",
    icon: <PlusIcon />,
  },
];
