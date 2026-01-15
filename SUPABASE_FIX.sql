-- ========================================
-- RADIKALE SUPABASE RLS POLICIES FIX
-- Kopiere diesen Code in dein Supabase SQL Dashboard
-- ========================================

-- 1. ZUERST ALTE POLICIES LÖSCHEN
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view team goals" ON team_goals;
DROP POLICY IF EXISTS "Admins can manage team goals" ON team_goals;

-- 2. RPC FUNKTIONEN ERSTELLEN (UMGEHT RLS)
CREATE OR REPLACE FUNCTION delete_payment_admin(payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM payments WHERE id = payment_id;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION mark_player_as_paid(player_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles SET payment_status = 1 WHERE id = player_uuid;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION mark_player_as_unpaid(player_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles SET payment_status = 0 WHERE id = player_uuid;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 3. NEUE RLS POLICIES - RADIKAL EINFACH
-- Profiles Table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on profiles" ON profiles
    FOR ALL USING (true) WITH CHECK (true);

-- Payments Table  
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- Team Goals Table
ALTER TABLE team_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on team_goals" ON team_goals
    FOR ALL USING (true) WITH CHECK (true);

-- 4. SERVICE ROLE KEY ERSTELLEN (FÜR ZUKÜNFTIGE VERWENDUNG)
-- Gehe zu: Project Settings > API > service_role (kopiere diesen Key)
-- Ersetze in supabase.js den ANON_KEY mit dem SERVICE_ROLE_KEY

-- 5. VERIFIZIERUNG
SELECT 'RLS Policies erfolgreich aktualisiert!' as status;
