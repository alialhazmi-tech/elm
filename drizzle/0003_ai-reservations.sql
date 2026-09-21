-- تسلسل الحجز على مستوى قاعدة البيانات قبل بدء الاستدعاءات الخارجية.
CREATE OR REPLACE FUNCTION alelm_reserve_ai(reservation text, reserved_cents integer, day_cap integer, month_cap integer)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE day_used bigint; month_used bigint; stamp text;
BEGIN
  IF reserved_cents <= 0 OR day_cap <= 0 OR month_cap <= 0 THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(714052);
  stamp := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  SELECT coalesce(sum(cost_cents) FILTER (WHERE at >= substr(stamp,1,10)),0), coalesce(sum(cost_cents),0)
    INTO day_used, month_used FROM ai_usage WHERE at >= substr(stamp,1,7);
  IF day_used + reserved_cents > day_cap OR month_used + reserved_cents > month_cap THEN RETURN false; END IF;
  INSERT INTO ai_usage(id, at, tool, model, input_tokens, output_tokens, cost_cents, actor)
    VALUES(reservation, stamp, 'reservation_pending', 'reserved-estimate', 0, 0, reserved_cents, 'system');
  RETURN true;
END; $$;
