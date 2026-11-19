-- Shape Audit storage. Run once in the Supabase SQL editor. Safe to run again.
--
-- Three tables with the same layout: the app keeps each record as JSON in "data" and syncs by id,
-- newest copy wins. The views at the bottom flatten the records for export and rule building.
--
-- Access: the app uses the project's anon key with no login, so anyone holding the URL and key can read,
-- add and change these rows. Nothing is ever hard-deleted; rows are flagged deleted or voided.

do $$
declare t text;
begin
  foreach t in array array['shape_machines', 'shape_shapes', 'shape_audits'] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      updated_at timestamptz not null default now(),
      deleted boolean not null default false,
      data jsonb not null)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "anon read" on public.%I', t);
    execute format('drop policy if exists "anon insert" on public.%I', t);
    execute format('drop policy if exists "anon update" on public.%I', t);
    execute format('create policy "anon read" on public.%I for select to anon using (true)', t);
    execute format('create policy "anon insert" on public.%I for insert to anon with check (true)', t);
    execute format('create policy "anon update" on public.%I for update to anon using (true) with check (true)', t);
    execute format('grant select, insert, update on public.%I to anon', t);
  end loop;
end $$;

-- One row per saved piece, with the machine name joined on.
create or replace view public.shape_audit_records with (security_invoker = true) as
select
  a.id,
  (a.data->>'at')::timestamptz        as audited_at,
  a.data->>'operator'                 as operator,
  a.data->>'machine_id'               as machine_id,
  m.data->>'name'                     as machine,
  m.data->>'feed'                     as feed,
  (a.data->>'wire')::numeric          as wire,
  (a.data->>'actual')::numeric        as actual_diameter,
  (a.data->>'pin')::numeric           as pin,
  a.data->>'profile'                  as pin_profile,
  a.data->>'shape_id'                 as shape_id,
  a.data->>'shape_name'               as shape_name,
  a.data->>'code'                     as shape_code,
  a.data->'legs'                      as lengths,
  coalesce((a.data->>'rev')::boolean, false)    as bent_from_end,
  a.data->>'status'                   as status,
  a.data->>'note'                     as note,
  coalesce((a.data->>'voided')::boolean, false) as voided
from public.shape_audits a
left join public.shape_machines m on m.id = a.data->>'machine_id'
where not a.deleted;

-- One row per machine.
create or replace view public.shape_machine_list with (security_invoker = true) as
select
  id,
  data->>'name'   as name,
  data->>'feed'   as feed,
  data->'wires'   as diameters,
  data->'pins'    as pins,
  coalesce((data->>'radius')::boolean, false)  as radius_shapes,
  coalesce((data->>'reverse')::boolean, false) as reverse_bend,
  data->>'notes'  as notes
from public.shape_machines
where not deleted;

grant select on public.shape_audit_records, public.shape_machine_list to anon;
