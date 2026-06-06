"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  BookOpenIcon,
  GearIcon,
  TerminalIcon,
} from "@phosphor-icons/react"

const data = {
  navMain: [
    {
      title: "Tunnels",
      url: "/dashboard",
      icon: <TerminalIcon />,
      isActive: true,
      items: [
        {
          title: "Overview",
          url: "/dashboard",
        },
        {
          title: "New Tunnel",
          url: "/dashboard/new",
        },
      ],
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
    {
      title: "Settings",
      url: "#",
      icon: <GearIcon />,
      items: [
        {
          title: "General",
          url: "#",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
