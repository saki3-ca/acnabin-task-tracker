-- ============================================================================
-- FIRM COSTING theme: one look for everyone, changed by Admin only.
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_firm_costing.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.firm_costing_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.firm_costing_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_costing_settings FROM anon, authenticated;

-- the saved theme ('' when none yet; NULL when the caller may not open Firm Costing)
CREATE OR REPLACE FUNCTION public.app_firm_costing_theme_get(p_session TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._firm_costing_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT value FROM public.firm_costing_settings WHERE key = 'theme'), '');
END;
$$;

-- Admin only; returns OK / FORBIDDEN / INVALID_INPUT / NO_ACCESS
CREATE OR REPLACE FUNCTION public.app_firm_costing_theme_set(p_session TEXT, p_theme TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._firm_costing_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_theme NOT IN ('classic', 'glass', 'vivid') THEN RETURN 'INVALID_INPUT'; END IF;
  INSERT INTO public.firm_costing_settings (key, value, updated_by) VALUES ('theme', p_theme, v_user.id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_firm_costing_theme_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_firm_costing_theme_set(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_firm_costing_theme_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_firm_costing_theme_set(TEXT, TEXT) TO anon, authenticated;
