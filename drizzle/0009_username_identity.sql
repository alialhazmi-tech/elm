-- يفشل الترحيل عند وجود أسماء متعارضة؛ لا يعيد تسمية الحسابات أو يدمجها تلقائيًا.
CREATE UNIQUE INDEX "users_username_normalized_uidx" ON "users" (lower(btrim("username")));
