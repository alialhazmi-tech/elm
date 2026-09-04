import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../db/schema.ts";

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const columns = Object.values(schema).filter(value => is(value, PgTable)).flatMap(table => {
  const config = getTableConfig(table);
  return config.columns.map(column => `(${literal(config.name)},${literal(column.name)},${literal(column.getSQLType())})`);
});

/** قراءة المخطط فقط: لا أسرار أو بيانات حسابات، ولا أي ترحيل تلقائي. */
export const DATABASE_READINESS_SQL = `
select required.table_name || '.' || required.column_name as missing
from (values ${columns.join(",")}) as required(table_name,column_name,data_type)
where not exists (
  select 1 from information_schema.columns actual
  where actual.table_schema='public' and actual.table_name=required.table_name
    and actual.column_name=required.column_name and actual.data_type=required.data_type
)
union all
select signature from (values
  ('public.alelm_assert_story_version(text,integer,text)'),
  ('public.alelm_reserve_ai(text,integer,integer,integer)')
) as required(signature) where to_regprocedure(signature) is null
order by missing`;
