-- This function is invoked by the ensure_rls DDL event trigger, not by application clients.
-- Revoke direct RPC execution while preserving the database event-trigger behavior.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
