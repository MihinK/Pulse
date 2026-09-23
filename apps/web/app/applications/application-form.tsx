"use client";

import { useState, type FormEvent, type JSX } from "react";
import { ApiError } from "../lib/api-client";
import type { CreateApplicationInput, Environment } from "../lib/applications-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ENVIRONMENTS: Environment[] = ["DEV", "STAGING", "PROD"];

export interface ApplicationFormValues {
  name: string;
  baseUrl: string;
  environment: Environment;
  description: string;
  checkIntervalMinutes: number;
  timeoutMs: number;
  slowThresholdMs: number;
}

const DEFAULT_VALUES: ApplicationFormValues = {
  name: "",
  baseUrl: "",
  environment: "PROD",
  description: "",
  checkIntervalMinutes: 5,
  timeoutMs: 10_000,
  slowThresholdMs: 2000,
};

export interface ApplicationFormProps {
  initialValues?: Partial<ApplicationFormValues>;
  submitLabel: string;
  onSubmit: (input: CreateApplicationInput) => Promise<void>;
}

/** Shared by `/applications/new` and `/applications/:id/edit` (FR-APP-01/02). */
export function ApplicationForm({ initialValues, submitLabel, onSubmit }: ApplicationFormProps): JSX.Element {
  const [values, setValues] = useState<ApplicationFormValues>({ ...DEFAULT_VALUES, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name,
        baseUrl: values.baseUrl,
        environment: values.environment,
        description: values.description || undefined,
        checkIntervalMinutes: values.checkIntervalMinutes,
        timeoutMs: values.timeoutMs,
        slowThresholdMs: values.slowThresholdMs,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="mt-6 flex max-w-lg flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-name">Name</Label>
        <Input
          id="app-name"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-base-url">Base URL</Label>
        <Input
          id="app-base-url"
          type="url"
          placeholder="https://api.example.com"
          value={values.baseUrl}
          onChange={(event) => set("baseUrl", event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-environment">Environment</Label>
        <Select value={values.environment} onValueChange={(value) => set("environment", value as Environment)}>
          <SelectTrigger id="app-environment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENVIRONMENTS.map((environment) => (
              <SelectItem key={environment} value={environment}>
                {environment}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-description">Description</Label>
        <Input
          id="app-description"
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-interval">Check interval (minutes)</Label>
        <Input
          id="app-interval"
          type="number"
          min={1}
          value={values.checkIntervalMinutes}
          onChange={(event) => set("checkIntervalMinutes", Number(event.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-timeout">Timeout (ms)</Label>
        <Input
          id="app-timeout"
          type="number"
          min={1}
          value={values.timeoutMs}
          onChange={(event) => set("timeoutMs", Number(event.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="app-slow-threshold">Slow threshold (ms)</Label>
        <Input
          id="app-slow-threshold"
          type="number"
          min={1}
          value={values.slowThresholdMs}
          onChange={(event) => set("slowThresholdMs", Number(event.target.value))}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
