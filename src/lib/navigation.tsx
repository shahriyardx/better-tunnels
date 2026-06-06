import {
  BookOpenIcon,
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
    icon: <TerminalIcon />,
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
  {
    title: "Documentation",
    url: "#",
    icon: <BookOpenIcon />,
    items: [
      {
        title: "Cloudflare Tunnels",
        url: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/",
      },
    ],
  },
];
