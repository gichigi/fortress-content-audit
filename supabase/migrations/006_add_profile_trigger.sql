-- Auto-create profile when user signs up via Supabase Auth
-- This is the Supabase-recommended approach (vs API call)

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'free'
  );
  return new;
end;
$$;

-- Trigger to call handle_new_user when new user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Grant necessary permissions
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant insert on table public.profiles to supabase_auth_admin;


