-- Create profiles table for user entitlements
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id),
  name text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable row level security and allow users to read their own row
alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using ( auth.uid() = user_id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = user_id );

-- Update trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
