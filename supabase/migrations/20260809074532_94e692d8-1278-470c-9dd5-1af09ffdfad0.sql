CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _role public.app_role;
begin
  insert into public.profiles (id, first_name, last_name, institution)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'institution'
  );

  begin
    _role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'student');
  exception when others then
    _role := 'student';
  end;

  -- Only non-privileged roles may be self-assigned at signup.
  -- institution_admin / super_admin must be granted by a super_admin afterwards.
  if _role not in ('student', 'faculty') then
    _role := 'student';
  end if;

  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;