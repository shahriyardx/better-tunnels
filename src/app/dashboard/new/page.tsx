"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { ArrowLeftIcon, CircleNotchIcon } from "@phosphor-icons/react";

const formSchema = z.object({
  name: z.string().min(1, "Tunnel name is required"),
  subdomain: z.string().optional().default(""),
  domain: z.string().min(1, "Domain is required"),
  target: z.string().min(1, "Target host is required"),
  port: z.string().refine(
    (v) => {
      const n = Number(v);
      return !Number.isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 65535;
    },
    "Port must be between 1 and 65535",
  ),
});

type FormData = z.output<typeof formSchema>;

export default function NewTunnelPage() {
  const router = useRouter();
  const [zones, setZones] = useState<string[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<string>("");

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      domain: "",
      target: "localhost",
      port: "",
    },
  });

  const computeDomain = (sub: string, zone: string) =>
    zone ? (sub ? `${sub}.${zone}` : zone) : sub || "";

  const handleSubdomainChange = (value: string) => {
    const zone = getValues("domain")?.replace(/^[^.]+\./, "") || selectedZone;
    setValue("domain", computeDomain(value, selectedZone), { shouldValidate: zone ? true : false });
  };

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    const sub = getValues("subdomain") || "";
    setValue("domain", computeDomain(sub, zone), { shouldValidate: true });
  };

  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (data.domains?.length) {
          setZones(data.domains);
          const first = data.domains[0];
          setSelectedZone(first);
          setValue("domain", first, { shouldValidate: true });
        }
      })
      .catch(() => {})
      .finally(() => setZonesLoading(false));
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/tunnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, port: Number(data.port) }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create tunnel");

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Failed to create tunnel",
      });
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="gap-1.5"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <h1 className="text-sm font-medium">New Tunnel</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 max-w-lg mx-auto w-full pt-12">
          {zonesLoading ? (
            <div className="flex flex-1 items-center justify-center min-h-[300px]">
              <CircleNotchIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Tunnel Name</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="my-app-tunnel"
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                  />
                  <FieldDescription>
                    Used by cloudflared to identify this tunnel.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="subdomain"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Domain</FieldLabel>
                  <div className="flex items-start gap-1">
                    <div className="flex-1">
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="subdomain"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                        onChange={(e) => {
                          field.onChange(e);
                          handleSubdomainChange(e.target.value);
                        }}
                      />
                    </div>
                    <span className="mt-2 text-sm text-muted-foreground font-mono">.</span>
                    <div className="flex-[3]">
                      <Select
                        value={selectedZone}
                        onValueChange={handleZoneChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="domain.com" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FieldDescription>
                    Subdomain prefix + Cloudflare zone. Example: app.shahriyar.dev
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Controller
                  name="target"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Target Host
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="localhost"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
              <div>
                <Controller
                  name="port"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Port</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="number"
                        placeholder="3000"
                        min={1}
                        max={65535}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </div>

            {errors.root && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                {errors.root.message}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Tunnel"}
              </Button>
            </div>
          </form>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
