import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseConfig } from "./supabase";

const original = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  publishable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret: process.env.SUPABASE_SECRET_KEY,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = original.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = original.anon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = original.service;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = original.publishable;
  process.env.SUPABASE_SECRET_KEY = original.secret;
});

describe("Supabase configuration", () => {
  it("rejects production mode without all required server credentials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseConfig()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
  it("returns the public endpoint and server-only service key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    expect(getSupabaseConfig()).toEqual({ url: "https://example.supabase.co", anonKey: "anon", serviceRoleKey: "service" });
  });
  it("accepts the current Dashboard publishable and secret key names", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SECRET_KEY = "secret";
    expect(getSupabaseConfig()).toEqual({ url: "https://example.supabase.co", anonKey: "publishable", serviceRoleKey: "secret" });
  });
});