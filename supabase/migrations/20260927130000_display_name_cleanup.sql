-- Names without any letters (the reports contain a couple of players named "." and "-") show as
-- "Unknown player" instead of ". ." / "-. -.". Same rule as src/lib/nameMask.ts.

create or replace function public.display_name_for(p_forename text, p_surname text, p_display_name text, p_consent boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  with parts as (
    select case when trim(p_forename)     ~ '[[:alpha:]]' then trim(p_forename)     end as f,
           case when trim(p_surname)      ~ '[[:alpha:]]' then trim(p_surname)      end as s,
           case when trim(p_display_name) ~ '[[:alpha:]]' then trim(p_display_name) end as d
  )
  select case
    when coalesce(p_consent, false) then
      coalesce(d, nullif(concat_ws(' ', f, s), ''), 'Unknown player')
    else
      coalesce(nullif(concat_ws(' ', upper(left(f, 1)) || '.', upper(left(s, 1)) || '.'), ''), 'Unknown player')
  end
  from parts;
$$;
