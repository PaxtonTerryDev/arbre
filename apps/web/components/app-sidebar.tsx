"use client";

import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  RowsIcon,
  WaveformIcon,
  CommandIcon,
  TerminalIcon,
  RobotIcon,
  BookOpenIcon,
  GearIcon,
  CropIcon,
  ChartPieIcon,
  MapTrifoldIcon,
  TreeIcon,
} from "@phosphor-icons/react";

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Gold Team",
      logo: <RowsIcon />,
    },
    {
      name: "Blue Team",
      logo: <WaveformIcon />,
    },
    {
      name: "Red Team",
      logo: <CommandIcon />,
    },
  ],
  navMain: [
    {
      title: "Applications",
      url: "#",
      icon: <TerminalIcon />,
      isActive: true,
      items: [
        {
          title: "Main Site",
          url: "#",
        },
        {
          title: "Fulfillment API",
          url: "#",
        },
      ],
    },
    {
      title: "Queues",
      url: "#",
      icon: <RobotIcon />,
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: <BookOpenIcon />,
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
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
        {
          title: "Team",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: <CropIcon />,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: <ChartPieIcon />,
    },
    {
      name: "Travel",
      url: "#",
      icon: <MapTrifoldIcon />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <TreeIcon />
          </div>
          <span className="text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Arbre</span>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <TeamSwitcher teams={data.teams} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
