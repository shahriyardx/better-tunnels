import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DotsThreeOutlineIcon, PlusIcon } from "@phosphor-icons/react";

export function TunnelsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-none bg-muted p-4 mb-4">
        <DotsThreeOutlineIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">No tunnels yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Create your first Cloudflare Tunnel to expose a local service to the internet.
      </p>
      <Link href="/dashboard/new">
        <Button className="gap-1.5">
          <PlusIcon className="h-4 w-4" />
          New Tunnel
        </Button>
      </Link>
    </div>
  );
}
