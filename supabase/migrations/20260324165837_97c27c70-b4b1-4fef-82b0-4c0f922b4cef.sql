UPDATE public.events
SET reserve_limit = GREATEST(1, CEIL(max_participants * 0.3)::integer)
WHERE COALESCE(reserve_limit, 0) <= 0;