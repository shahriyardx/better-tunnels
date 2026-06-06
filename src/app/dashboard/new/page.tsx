"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field"
import { CircleNotchIcon } from "@phosphor-icons/react"
import { api } from "@/trpc/react"

const formSchema = z.object({
  name: z.string().min(1, "Tunnel name is required"),
  subdomain: z.string().optional().default(""),
  target: z.string().min(1, "Target host is required"),
  port: z.string().refine((v) => {
    const n = Number(v)
    return !Number.isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 65535
  }, "Port must be between 1 and 65535"),
})

type FormData = z.output<typeof formSchema>

export default function NewTunnelPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const { data: domainData, isLoading: zonesLoading } = api.domains.list.useQuery()

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      target: "localhost",
      port: "",
    },
  })

  const createMutation = api.tunnels.create.useMutation({
    onSuccess: () => {
      utils.tunnels.list.invalidate()
      router.push("/dashboard")
    },
    onError: (err) => {
      setError("root", { message: err.message })
    },
  })

  const zones = domainData?.zones ?? []
  const [selectedZone, setSelectedZone] = useState("")
  const watchedSubdomain = useWatch({ control, name: "subdomain" })

  // Auto-select first zone when zones load
  useEffect(() => {
    if (zones.length > 0 && !selectedZone) {
      setSelectedZone(zones[0])
    }
  }, [zones, selectedZone])

  const fullDomain = selectedZone
    ? watchedSubdomain
      ? `${watchedSubdomain}.${selectedZone}`
      : selectedZone
    : watchedSubdomain || ""

  const onSubmit = async (data: FormData) => {
    if (!selectedZone) return
    createMutation.mutate({
      name: data.name,
      domain: fullDomain,
      target: data.target,
      port: Number(data.port),
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 max-w-lg">
      {zonesLoading ? (
        <div className="flex flex-1 items-center justify-center min-h-75">
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
                      onChange={(e) => field.onChange(e)}
                    />
                  </div>
                  <span className="mt-2 text-sm text-muted-foreground font-mono">
                    .
                  </span>
                  <div className="flex-3">
                    <Select
                      value={selectedZone}
                      onValueChange={setSelectedZone}
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
                  Subdomain + zone. Example: app.shahriyar.dev
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
                    <FieldLabel htmlFor={field.name}>Target Host</FieldLabel>
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
              disabled={isSubmitting || createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Tunnel"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
