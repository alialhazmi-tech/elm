-- منح دور المحرر التثبيت والجدولة دون النشر الفوري أو تغيير الاستثناءات الفردية.
INSERT INTO role_permissions (role_id, permission_key)
SELECT id, permission_key
FROM roles
CROSS JOIN (VALUES ('story.pin'), ('story.schedule')) AS granted(permission_key)
WHERE id = 'editor'
ON CONFLICT (role_id, permission_key) DO NOTHING;
