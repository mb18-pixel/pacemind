-- Migration: Add Zielpace and Zieldistanz to profiles
-- Führe diesen SQL-Code im Supabase SQL Editor aus.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS zielpace text,
ADD COLUMN IF NOT EXISTS zieldistanz text;
